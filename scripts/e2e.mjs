/* End-to-end smoke test against the running server (PORT 3100). */
const BASE = "http://localhost:3100";
let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

function client() {
  let cookie = null;
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(";")[0];
      if (pair.startsWith("mc_session=")) cookie = pair;
    }
    let json = {};
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  };
}

const TODAY = "2026-10-06";
const MONTH = "2026-10";
const DAILY_FOOD = 60_000;
const DAYS_IN_MONTH = 31;
const ELAPSED_DAYS = 6;
const MONTH_FOOD = DAILY_FOOD * DAYS_IN_MONTH;
const CARRY_TODAY = DAILY_FOOD * (ELAPSED_DAYS - 1);
const AVAILABLE_TODAY = DAILY_FOOD * ELAPSED_DAYS;

async function main() {
  /* ---------------------------- user A: preset ---------------------------- */
  console.log("\nUser A — phone login + 50/30/20 preset");
  const a = client();

  const badPhone = await a("/api/auth/request-otp", { method: "POST", body: { phone: "abc" } });
  check("rejects invalid phone", badPhone.status === 400, `got ${badPhone.status}`);

  const otpReq = await a("/api/auth/request-otp", { method: "POST", body: { phone: "0811 222 3334" } });
  check("otp issued (dev mode)", otpReq.status === 200 && otpReq.json.devOtp?.length === 6, JSON.stringify(otpReq.json));
  check("normalized to +628112223334", otpReq.json.phone === "+628112223334");

  const cooldown = await a("/api/auth/request-otp", { method: "POST", body: { phone: "08112223334" } });
  check("resend cooldown enforced", cooldown.status === 429, `got ${cooldown.status}`);

  const wrongCode = await a("/api/auth/verify-otp", { method: "POST", body: { phone: "08112223334", code: "000000" } });
  const realOtp = otpReq.json.devOtp;
  const rejected = wrongCode.status === 401 || wrongCode.status === 400;
  check("wrong code rejected", rejected || realOtp === "000000", `got ${wrongCode.status} ${JSON.stringify(wrongCode.json)}`);

  // A failed attempt does not consume the code, so the original OTP stays valid.
  // (If the random OTP happened to be 000000, the "wrong" attempt already verified.)
  const verify =
    wrongCode.status === 200 ? wrongCode : await a("/api/auth/verify-otp", { method: "POST", body: { phone: "08112223334", code: realOtp } });
  check("verify sets session + mustOnboard", verify.status === 200 && verify.json.mustOnboard === true, JSON.stringify(verify.json));

  const meBefore = await a("/api/me");
  check("me returns user, not onboarded", meBefore.json.user?.onboarded === false && meBefore.json.backbone === null);

  const onboard = await a("/api/onboarding", {
    method: "POST",
    body: {
      displayName: "Andi",
      locale: "id",
      monthlyIncome: 6_000_000,
      dailyFoodBudget: DAILY_FOOD,
      backbone: { presetId: 1 },
    },
  });
  check("onboarding with preset", onboard.status === 200, JSON.stringify(onboard.json));

  const overview = await a(`/api/overview?date=${TODAY}&month=${MONTH}`);
  const ov = overview.json.overview;
  check("overview loads", overview.status === 200 && ov, JSON.stringify(overview.json).slice(0, 200));
  check("3 backbone categories from 50/30/20", ov?.categories?.length === 3);
  check("allocations = 3M / 1.8M / 1.2M", ov?.categories?.map((c) => c.allocated).join(",") === "3000000,1800000,1200000", JSON.stringify(ov?.categories?.map((c) => c.allocated)));
  check(`daily food budget = ${DAILY_FOOD}`, ov?.food?.dailyBudget === DAILY_FOOD, `got ${ov?.food?.dailyBudget}`);
  check(`month food budget = ${MONTH_FOOD}`, ov?.food?.budget === MONTH_FOOD, `got ${ov?.food?.budget}`);
  check(`carry compounds over ${ELAPSED_DAYS - 1} quiet days = ${CARRY_TODAY}`, ov?.food?.carry === CARRY_TODAY, `got ${ov?.food?.carry}`);
  check(`available today = daily + carry = ${AVAILABLE_TODAY}`, ov?.food?.availableToday === AVAILABLE_TODAY, `got ${ov?.food?.availableToday}`);
  check("preset overspend target = Wants", ov?.food?.targetCategoryName === "Wants", `got ${ov?.food?.targetCategoryName}`);
  check("no food logged yet", ov?.food?.spent === 0 && ov?.food?.overspend === 0);

  const needsId = ov.categories.find((c) => c.kind === "needs").id;
  const savingsId = ov.categories.find((c) => c.kind === "savings").id;
  const seedNeedsId = 1; // preset seed row — must NOT be usable

  /* --------------------- rule 4: category must be owned --------------------- */
  console.log("\nRule 4 — expense must link to the user's own backbone child");
  const foreignCat = await a("/api/expenses", {
    method: "POST",
    body: { name: "Sneaky", amount: 10_000, spentOn: TODAY, categoryId: seedNeedsId },
  });
  check("rejects preset/foreign category", foreignCat.status === 400, `got ${foreignCat.status}`);

  const noCategory = await a("/api/expenses", {
    method: "POST",
    body: { name: "No cat", amount: 10_000, spentOn: TODAY, categoryId: 999999 },
  });
  check("rejects unknown category", noCategory.status === 400, `got ${noCategory.status}`);

  const kos = await a("/api/expenses", {
    method: "POST",
    body: { name: "Kos", amount: 1_900_000, spentOn: "2026-10-01", categoryId: needsId },
  });
  check("valid expense saved", kos.status === 201, JSON.stringify(kos.json));

  const list = await a(`/api/expenses?month=${MONTH}`);
  check("expenses list shows Kos linked to Needs", list.json.expenses?.[0]?.categoryName === "Needs", JSON.stringify(list.json.expenses?.[0]));

  /* ------------------- food: daily chain + automatic re-booking ----------------- */
  console.log("\nFood tracker — compounding daily chain + automatic re-booking (requirement 6)");

  // Within-rule meals: 40k + 30k on today, well under the 360k available.
  const meal1 = await a("/api/food", { method: "POST", body: { name: "Nasi padang", amount: 40_000, spentOn: TODAY } });
  const meal2 = await a("/api/food", { method: "POST", body: { name: "Kopi", amount: 30_000, spentOn: TODAY } });
  check("meals default to Needs (food default)", meal1.status === 201 && meal2.status === 201);

  const food1 = await a(`/api/food?month=${MONTH}&date=${TODAY}`);
  const f1 = food1.json.food;
  check("food spend = 70000", f1?.spent === 70_000, `got ${f1?.spent}`);
  check("today spent = 70000", f1?.todaySpent === 70_000, `got ${f1?.todaySpent}`);
  check("no overspend while within allowance", f1?.overspend === 0, `got ${f1?.overspend}`);
  check("carry still counts into today", f1?.carry === CARRY_TODAY, `got ${f1?.carry}`);
  check("food entries linked to Needs", f1?.entries?.every((e) => e.categoryName === "Needs"), JSON.stringify(f1?.entries?.map((e) => e.categoryName)));

  // One 400k meal tips today over: 470k spent vs 360k available -> 110k re-booked.
  const meal3 = await a("/api/food", { method: "POST", body: { name: "Feast", amount: 400_000, spentOn: TODAY } });
  check("large meal recorded", meal3.status === 201, JSON.stringify(meal3.json));

  const expectedOverspend = 70_000 + 400_000 - AVAILABLE_TODAY; // 110000
  const food2 = await a(`/api/food?month=${MONTH}&date=${TODAY}`);
  const f2 = food2.json.food;
  check("food spend = 470000", f2?.spent === 470_000, `got ${f2?.spent}`);
  check(`overspend = ${expectedOverspend} computed per view`, f2?.overspend === expectedOverspend, `got ${f2?.overspend}`);
  check("overspend today = same (one overspent day)", f2?.overspendToday === expectedOverspend, `got ${f2?.overspendToday}`);
  check("overspend target = Wants", f2?.targetCategoryName === "Wants", `got ${f2?.targetCategoryName}`);
  const overspentDay = f2?.days?.find((d) => d.date === TODAY);
  check(`today's day cell marks the ${expectedOverspend} overage`, overspentDay?.over === expectedOverspend, `got ${overspentDay?.over}`);

  // Overview mirrors the re-booking: Wants absorbs the overage, Needs keeps the in-rule slice.
  const ovAfterFood = (await a(`/api/overview?date=${TODAY}&month=${MONTH}`)).json.overview;
  const wantsCat = ovAfterFood.categories.find((c) => c.kind === "wants");
  const needsCat = ovAfterFood.categories.find((c) => c.kind === "needs");
  check(`Wants spent = overage (${expectedOverspend})`, wantsCat?.spent === expectedOverspend, `got ${wantsCat?.spent}`);
  check("Needs spent = Kos + in-rule food", needsCat?.spent === 1_900_000 + (470_000 - expectedOverspend), `got ${needsCat?.spent}`);
  const expAfter = await a(`/api/expenses?month=${MONTH}`);
  check("no synthetic leftover rows (every row is a real expense)", expAfter.json.expenses?.every((e) => e.kind === "expense"), JSON.stringify(expAfter.json.expenses?.map((e) => e.kind)));

  /* --------------------------- user B: custom ------------------------------ */
  console.log("\nUser B — custom backbone validation + no daily food budget");
  const b = client();
  const otpB = await b("/api/auth/request-otp", { method: "POST", body: { phone: "+62 899-000-1111" } });
  const verifyB = await b("/api/auth/verify-otp", { method: "POST", body: { phone: "+628990001111", code: otpB.json.devOtp } });
  check("user B signed up", verifyB.status === 200 && verifyB.json.mustOnboard === true, JSON.stringify(verifyB.json));

  const badSum = await b("/api/onboarding", {
    method: "POST",
    body: {
      displayName: "Budi",
      locale: "en",
      monthlyIncome: 5_000_000,
      dailyFoodBudget: 0,
      backbone: {
        name: "Almost",
        categories: [
          { name: "Living", kind: "needs", percentBp: 6000, defaultForFood: true },
          { name: "Fun", kind: "wants", percentBp: 3000, defaultForFood: false },
        ],
        foodOverspendCategoryIndex: 0,
      },
    },
  });
  check("rejects sum != 100%", badSum.status === 400 && /10%|10\.00%/i.test(badSum.json.error ?? ""), JSON.stringify(badSum.json));

  const noOverspend = await b("/api/onboarding", {
    method: "POST",
    body: {
      displayName: "Budi",
      locale: "en",
      monthlyIncome: 5_000_000,
      dailyFoodBudget: 0,
      backbone: {
        name: "No target",
        categories: [
          { name: "Living", kind: "needs", percentBp: 7000, defaultForFood: true },
          { name: "Fun", kind: "wants", percentBp: 3000, defaultForFood: false },
        ],
      },
    },
  });
  check("rejects custom backbone without overspend target", noOverspend.status === 400 && /overspend/i.test(noOverspend.json.error ?? ""), JSON.stringify(noOverspend.json));

  const twoFoodDefaults = await b("/api/onboarding", {
    method: "POST",
    body: {
      displayName: "Budi",
      locale: "en",
      monthlyIncome: 5_000_000,
      dailyFoodBudget: 0,
      backbone: {
        name: "Two defaults",
        categories: [
          { name: "Living", kind: "needs", percentBp: 7000, defaultForFood: true },
          { name: "Fun", kind: "wants", percentBp: 3000, defaultForFood: true },
        ],
        foodOverspendCategoryIndex: 1,
      },
    },
  });
  check("rejects two food defaults", twoFoodDefaults.status === 400 && /Exactly one/i.test(twoFoodDefaults.json.error ?? ""), JSON.stringify(twoFoodDefaults.json));

  const goodCustom = await b("/api/onboarding", {
    method: "POST",
    body: {
      displayName: "Budi",
      locale: "en",
      monthlyIncome: 5_000_000,
      dailyFoodBudget: 0,
      backbone: {
        name: "Budi rules",
        categories: [
          { name: "Living", kind: "needs", percentBp: 7000, defaultForFood: true },
          { name: "Fun", kind: "wants", percentBp: 2000, defaultForFood: false },
          { name: "Save", kind: "savings", percentBp: 1000, defaultForFood: false },
        ],
        foodOverspendCategoryIndex: 2,
      },
    },
  });
  check("valid custom backbone accepted", goodCustom.status === 200, JSON.stringify(goodCustom.json));

  const ovB = (await b(`/api/overview?date=${TODAY}&month=${MONTH}`)).json.overview;
  check("user B backbone = custom rules", ovB?.backbone?.name === "Budi rules", `got ${ovB?.backbone?.name}`);
  check("user B overspend target = Save", ovB?.food?.targetCategoryName === "Save", `got ${ovB?.food?.targetCategoryName}`);
  check("user B has no user A data", (await b(`/api/expenses?month=${MONTH}`)).json.expenses.length === 0);

  // No daily budget (0) means no carry chain and no overspend, even after food spend.
  await b("/api/food", { method: "POST", body: { name: "Market", amount: 100_000, spentOn: TODAY } });
  const foodB = (await b(`/api/food?month=${MONTH}&date=${TODAY}`)).json.food;
  check("dailyBudget 0 → month budget 0", foodB?.budget === 0, `got ${foodB?.budget}`);
  check("dailyBudget 0 → no carry chain", foodB?.carry === 0 && foodB?.availableToday === 0, JSON.stringify({ carry: foodB?.carry, available: foodB?.availableToday }));
  check("dailyBudget 0 → no overspend", foodB?.overspend === 0, `got ${foodB?.overspend}`);

  /* ------------------------------- budget edit ------------------------------ */
  console.log("\nBudget editing");
  const budgetA = await a("/api/budget");
  const cats = budgetA.json.backbone.categories;
  const overBudget = await a("/api/budget", {
    method: "PUT",
    body: {
      categories: cats.map((c) => ({ ...c, percentBp: c.percentBp + 100 })),
      foodOverspendCategoryIndex: 2,
    },
  });
  check("PUT rejects sum > 100%", overBudget.status === 400, `got ${overBudget.status}`);

  const goodPut = await a("/api/budget", {
    method: "PUT",
    body: {
      name: "Andi rules",
      // savings 20%->25%, paid for by dropping needs 50%->45% so the sum stays 100%
      categories: cats.map((c) => ({
        ...c,
        percentBp: c.id === savingsId ? 2500 : c.id === needsId ? 4500 : c.percentBp,
      })),
      foodOverspendCategoryIndex: 2,
    },
  });
  check("PUT updates percentages (20%->25% savings)", goodPut.status === 200 && goodPut.json.backbone.categories.find((c) => c.id === savingsId)?.percentBp === 2500, JSON.stringify(goodPut.json).slice(0, 300));

  // Try to delete `needs` (which has linked expenses): fold its 50% into wants
  // and hand the food default over, so validation reaches the linked check.
  const wantsId = cats.find((c) => c.kind === "wants").id;
  const delUsed = await a("/api/budget", {
    method: "PUT",
    body: {
      categories: cats
        .filter((c) => c.id !== needsId)
        .map((c) => ({
          ...c,
          percentBp: c.id === wantsId ? 8000 : 2000,
          defaultForFood: c.id === wantsId,
        })),
      foodOverspendCategoryIndex: 1, // savings
    },
  });
  check("cannot delete a category with linked expenses", delUsed.status === 400 && /linked/i.test(delUsed.json.error ?? ""), JSON.stringify(delUsed.json));

  const switched = await a("/api/budget/switch", { method: "POST", body: { presetId: 3 } });
  check("switch to preset 60/20/20", switched.status === 200 && switched.json.backbone.categories.length === 3, JSON.stringify(switched.json).slice(0, 200));
  check("switched name = 60 / 20 / 20", switched.json.backbone?.name === "60 / 20 / 20", `got ${switched.json.backbone?.name}`);
  check("expenses survive backbone switch (Kos still there)", (await a(`/api/expenses?month=${MONTH}`)).json.expenses.some((e) => e.name === "Kos"));

  /* --------------------------------- pages --------------------------------- */
  console.log("\nPages (HTML)");
  for (const path of ["/login", "/onboarding", "/dashboard", "/expenses", "/food", "/budget", "/settings"]) {
    const res = await fetch(BASE + path, { headers: { cookie: "mc_session=bogus" } });
    const status = path === "/login" ? res.status : res.status;
    check(`GET ${path} → ${status}`, status === 200 || status === 307, `got ${status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
