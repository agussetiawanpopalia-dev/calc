/* Visual audit: asserts layout/material facts in a real browser.
 * Usage: node scripts/visual-audit.mjs   (server must be on :3100)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
let passed = 0;
let failed = 0;
function check(scope, label, ok, detail = "") {
  if (ok) { passed++; console.log(`  ✓ [${scope}] ${label}`); }
  else { failed++; console.log(`  ✗ [${scope}] ${label} ${detail}`); }
}

async function sessionCookie() {
  let code = null;
  for (let attempt = 0; attempt < 3 && !code; attempt++) {
    const req = await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "0899 000-1111" }),
    });
    const issued = await req.json();
    if (issued.devOtp) { code = issued.devOtp; break; }
    const wait = Number(/wait (\d+)s/.exec(issued.error ?? "")?.[1] ?? 5);
    console.log(`  (otp cooldown: waiting ${wait}s)`);
    await new Promise((r) => setTimeout(r, wait * 1000 + 500));
  }
  if (!code) throw new Error("could not obtain dev otp");
  const res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "+628990001111", code }),
  });
  if (res.status !== 200) throw new Error(`verify failed: ${res.status} ${await res.text()}`);
  const raw = res.headers.getSetCookie().find((c) => c.startsWith("mc_session="));
  if (!raw) throw new Error("no session cookie");
  return raw.split(";")[0].split("=").slice(1).join("=");
}

const PAGES = ["/dashboard", "/food", "/expenses", "/budget", "/settings"];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];
const EXPECT_BODY_BG = { light: "rgb(242, 242, 247)", dark: "rgb(0, 0, 0)" };
const EXPECT_CARD_BG = { light: "rgb(255, 255, 255)", dark: "rgb(28, 28, 30)" };

const cookie = await sessionCookie();
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
    });
    await ctx.addCookies([{ name: "mc_session", value: cookie, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();

    for (const path of PAGES) {
      const scope = `${vp.name}/${scheme}${path}`;
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);

      const data = await page.evaluate(() => {
        const vw = window.innerWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > vw + 1;
          })
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(el.getBoundingClientRect().right)}`);

        const style = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { bg: cs.backgroundColor, filter: cs.backdropFilter || cs.webkitBackdropFilter, font: cs.fontFamily, pb: cs.paddingBottom, h: r.height, w: r.width };
        };

        const buttons = [...document.querySelectorAll("button, a.press")]
          .filter((el) => el.getBoundingClientRect().height > 0)
          .map((el) => ({ cls: String(el.className), h: Math.round(el.getBoundingClientRect().height) }));

        const foodCard = [...document.querySelectorAll("div.card, div[class*=material]")]
          .find((el) => el.textContent.includes("Food today"));

        return {
          vw,
          scrollWidth: document.documentElement.scrollWidth,
          offenders,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          bodyFont: getComputedStyle(document.body).fontFamily,
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          card: style(".card"),
          tabbar: style("nav > div"),
          header: style(".material-bar"),
          pbSafe: document.querySelector(".pb-safe") ? getComputedStyle(document.querySelector(".pb-safe")).paddingBottom : null,
          buttons,
          foodCardH: foodCard ? foodCard.getBoundingClientRect().height : null,
          pageH: document.documentElement.scrollHeight,
          bigNum: (() => {
            const el = [...document.querySelectorAll("p")].find((p) => getComputedStyle(p).fontSize === "34px");
            return el ? { size: getComputedStyle(el).fontSize, family: getComputedStyle(el).fontFamily } : null;
          })(),
        };
      });

      // 1. no horizontal overflow
      check(scope, "no horizontal overflow", data.scrollWidth <= data.vw + 1 && data.offenders.length === 0,
        `scrollWidth=${data.scrollWidth} vw=${data.vw} offenders=${JSON.stringify(data.offenders)}`);

      // 2. canvas + typography
      check(scope, `body bg = ${EXPECT_BODY_BG[scheme]}`, data.bodyBg === EXPECT_BODY_BG[scheme], `got ${data.bodyBg}`);
      check(scope, "system font stack", data.bodyFont.startsWith("-apple-system"), data.bodyFont.slice(0, 60));
      check(scope, 'html color-scheme = "light dark"', data.colorScheme === "light dark", `got ${data.colorScheme}`);

      // 3. materials
      if (data.tabbar) {
        const alpha = Number((data.tabbar.bg.match(/[\d.]+\)$/) || [0])[0].replace(")", ""));
        check(scope, "tab bar: glass blur", /blur\(/.test(data.tabbar.filter ?? ""), `filter=${data.tabbar.filter}`);
        check(scope, "tab bar: translucent thick material", alpha > 0.5 && alpha < 1, `bg=${data.tabbar.bg}`);
        check(scope, "tab bar: safe-area pad", parseFloat(data.pbSafe ?? "0") >= 64, `pb=${data.pbSafe}`);
      }
      if (data.header) {
        check(scope, "header: glass blur", /blur\(/.test(data.header.filter ?? ""), `filter=${data.header.filter}`);
      }

      // 4. surfaces flip in dark mode
      if (data.card) {
        check(scope, `card bg = ${EXPECT_CARD_BG[scheme]}`, data.card.bg === EXPECT_CARD_BG[scheme], `got ${data.card.bg}`);
      }

      // 5. touch targets: primary buttons and icon buttons are 44pt+
      const smallPrimary = data.buttons.filter((b) => b.cls.includes("min-h-[50px]") && b.h < 50);
      const smallIcon = data.buttons.filter((b) => /\bh-11\b/.test(b.cls) && b.h < 44);
      const smallTab = data.buttons.filter((b) => b.cls.includes("flex-1 flex-col") && b.h < 44);
      check(scope, "primary buttons ≥ 50px", smallPrimary.length === 0, JSON.stringify(smallPrimary));
      check(scope, "icon buttons ≥ 44px", smallIcon.length === 0, JSON.stringify(smallIcon));
      check(scope, "tab items ≥ 44px", smallTab.length === 0, JSON.stringify(smallTab));

      // 6. type hierarchy present
      if (path === "/dashboard") {
        check(scope, "large amount style (34px SF)", data.bigNum?.size === "34px" && /apple-system/.test(data.bigNum?.family ?? ""), JSON.stringify(data.bigNum));
        const ratio = data.foodCardH && data.pageH ? data.foodCardH / data.pageH : null;
        check(scope, `food card stays compact (${Math.round((ratio ?? 0) * 100)}% of page)`, ratio !== null && ratio < 0.3, `ratio=${ratio}`);
      }
    }
    await ctx.close();
  }
}

/* ------------------------------ interaction ------------------------------ */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  await ctx.addCookies([{ name: "mc_session", value: cookie, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  const scope = "interaction/expenses";
  await page.goto(`${BASE}/expenses`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // open the add-expense sheet (exercises Sheet open + body scroll lock)
  await page.locator('button:has-text("Add expense")').click();
  await page.waitForSelector("[role=dialog]");
  check(scope, "sheet opens", await page.isVisible("[role=dialog]"));
  const lock = await page.evaluate(() => document.body.style.overflow);
  check(scope, "body scroll locked while open", lock === "hidden", `overflow=${lock}`);

  // fill the form: name, keypad amount, category
  await page.fill('input[aria-label="What was it?"]', "UI test snack");
  for (const d of ["1", "5", "0", "0", "0"]) {
    await page.locator("[role=dialog] button", { hasText: new RegExp(`^${d}$`) }).first().click();
  }
  await page.locator("[role=dialog] select").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save expense" }).click();

  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 5000 });
  check(scope, "sheet closes after save", true);
  const lockAfter = await page.evaluate(() => document.body.style.overflow);
  check(scope, "body scroll released", lockAfter === "" || lockAfter === "auto", `overflow=${lockAfter}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  check(scope, "new expense appears in list", await page.getByText("UI test snack").isVisible());

  // reopen and dismiss with Escape
  await page.locator('button:has-text("Add expense")').click();
  await page.waitForSelector("[role=dialog]");
  await page.keyboard.press("Escape");
  const gone = await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 3000 }).then(() => true, () => false);
  check(scope, "Escape closes the sheet", gone);
  await ctx.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
