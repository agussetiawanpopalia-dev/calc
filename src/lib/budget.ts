/**
 * Budget domain engine: plans (percentage rules), category budgeting, and
 * daily-food tracking with intra-month carry-over (requirement 5) and automatic
 * overspend re-booking (requirement 6). All money in integer rupiah;
 * percentages in basis points (10000 = 100%).
 *
 * Food model:
 *  - One daily food budget per user. Unused allowance carries into the next day
 *    within the same month and compounds (a quiet day adds the full daily budget
 *    to tomorrow's allowance).
 *  - When a day out-spends its available budget, the over-budget slice is
 *    re-booked at view time from that day's food-linked categories to the plan's
 *    overspend target category (Wants for presets, user-chosen for custom plans).
 *  - No posting ledger: every view recomputes the chain from the day's food
 *    transactions (by id order), so totals always equal actual money spent.
 */
import { and, eq, like, desc, inArray, sql } from "drizzle-orm";
import { getDb, type Exec } from "./db";
import {
  backbones,
  backboneCategories,
  transactions,
  type Backbone,
  type BackboneCategory,
} from "./schema";
import { HttpError, type SessionUser } from "./auth";
import { daysInMonth, daysElapsed } from "./dates";

export type CategoryKind = "needs" | "wants" | "savings" | "debt" | "other";

export type CategoryInput = {
  id?: number;
  name: string;
  kind: CategoryKind;
  percentBp: number;
  defaultForFood: boolean;
};

export type ActiveBackbone = { backbone: Backbone; categories: BackboneCategory[] };

export const TOTAL_PERCENT_BP = 10_000;

/* --------------------------------- read paths --------------------------------- */

/** Read the user's active plan (and its categories) through `exec` (db or tx). */
async function loadActiveBackbone(exec: Exec, userId: number): Promise<ActiveBackbone | null> {
  const backbone = await exec
    .select()
    .from(backbones)
    .where(and(eq(backbones.userId, userId), eq(backbones.isActive, 1)))
    .limit(1)
    .get();
  if (!backbone) return null;
  const categories = await exec
    .select()
    .from(backboneCategories)
    .where(eq(backboneCategories.backboneId, backbone.id))
    .orderBy(backboneCategories.sortOrder, backboneCategories.id)
    .all();
  return { backbone, categories };
}

export async function getActiveBackbone(userId: number, exec?: Exec): Promise<ActiveBackbone | null> {
  return loadActiveBackbone(exec ?? (await getDb()), userId);
}

export async function listPresets(): Promise<Array<Backbone & { categories: BackboneCategory[] }>> {
  const db = await getDb();
  const presets = await db
    .select()
    .from(backbones)
    .where(eq(backbones.source, "preset"))
    .orderBy(backbones.id)
    .all();
  return Promise.all(
    presets.map(async (preset) => ({
      ...preset,
      categories: await db
        .select()
        .from(backboneCategories)
        .where(eq(backboneCategories.backboneId, preset.id))
        .orderBy(backboneCategories.sortOrder, backboneCategories.id)
        .all(),
    })),
  );
}

export function serializeBackbone(active: ActiveBackbone) {
  return {
    id: active.backbone.id,
    name: active.backbone.name,
    description: active.backbone.description,
    foodOverspendCategoryId: active.backbone.foodOverspendCategoryId,
    categories: active.categories.map(serializeCategory),
  };
}

export function serializeCategory(c: BackboneCategory) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind as CategoryKind,
    percentBp: c.percentBp,
    defaultForFood: c.defaultForFood === 1,
    sortOrder: c.sortOrder,
  };
}

/* -------------------------------- validation --------------------------------- */

export function validateSpec(categories: CategoryInput[], foodOverspendCategoryIndex: number): void {
  if (categories.length < 1) throw new HttpError(400, "A plan needs at least one category.");
  if (categories.length > 12) throw new HttpError(400, "A plan can have at most 12 categories.");

  const sum = categories.reduce((total, c) => total + c.percentBp, 0);
  if (sum !== TOTAL_PERCENT_BP) {
    const shown = (sum / 100).toFixed(sum % 100 === 0 ? 0 : 2);
    const gap = Math.abs(TOTAL_PERCENT_BP - sum);
    const gapPct = (gap / 100).toFixed(gap % 100 === 0 ? 0 : 2);
    throw new HttpError(
      400,
      sum > TOTAL_PERCENT_BP
        ? `Percentages total ${shown}% — that's ${gapPct}% over. They must equal exactly 100%.`
        : `Percentages total ${shown}% — add ${gapPct}% more. They must equal exactly 100%.`,
    );
  }
  for (const [i, c] of categories.entries()) {
    if (!c.name.trim()) throw new HttpError(400, `Category ${i + 1} needs a name.`);
    if (c.percentBp <= 0 || c.percentBp > TOTAL_PERCENT_BP) {
      throw new HttpError(400, `"${c.name}" must be greater than 0% and at most 100%.`);
    }
  }
  const defaults = categories.filter((c) => c.defaultForFood);
  if (defaults.length !== 1) {
    throw new HttpError(400, "Exactly one category must be the default for daily food entries.");
  }
  // Requirement 6: the food overspend target must be decided before a custom plan can be saved.
  if (
    !Number.isInteger(foodOverspendCategoryIndex) ||
    foodOverspendCategoryIndex < 0 ||
    foodOverspendCategoryIndex >= categories.length
  ) {
    throw new HttpError(400, "Choose which category absorbs food overspend before saving this plan.");
  }
}

/** A category can only be unlinked while no expenses point at it (requirement 4). */
async function assertRemovable(categoryIds: number[], exec: Exec): Promise<void> {
  if (categoryIds.length === 0) return;
  const rows = await exec
    .select({ categoryId: transactions.categoryId, count: sql<number>`count(*)` })
    .from(transactions)
    .where(inArray(transactions.categoryId, categoryIds))
    .groupBy(transactions.categoryId)
    .all();
  if (rows.length > 0) {
    const names = await Promise.all(
      rows.map(async (r) => {
        const cat = await exec
          .select()
          .from(backboneCategories)
          .where(eq(backboneCategories.id, r.categoryId))
          .limit(1)
          .get();
        return `"${cat?.name ?? r.categoryId}" (${r.count} expense${r.count === 1 ? "" : "s"})`;
      }),
    );
    throw new HttpError(
      400,
      `Cannot remove ${names.join(", ")} — expenses are already linked to it. Reassign or delete those expenses first.`,
    );
  }
}

/* -------------------------------- write paths -------------------------------- */

/** Load the active plan written inside `tx`, or fail loudly if it vanished. */
async function requireActiveBackbone(exec: Exec, userId: number): Promise<ActiveBackbone> {
  const active = await loadActiveBackbone(exec, userId);
  if (!active) throw new HttpError(500, "Active backbone missing after write.");
  return active;
}

/** Clone a preset template into the user's active plan (deactivates the previous one). */
export async function clonePresetToUser(userId: number, presetId: number): Promise<ActiveBackbone> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const preset = await tx
      .select()
      .from(backbones)
      .where(and(eq(backbones.id, presetId), eq(backbones.source, "preset")))
      .limit(1)
      .get();
    if (!preset) throw new HttpError(404, "That backbone preset does not exist.");

    const presetCats = await tx
      .select()
      .from(backboneCategories)
      .where(eq(backboneCategories.backboneId, preset.id))
      .orderBy(backboneCategories.sortOrder, backboneCategories.id)
      .all();
    if (presetCats.length === 0) throw new HttpError(500, "Preset has no categories.");

    await tx
      .update(backbones)
      .set({ isActive: 0, updatedAt: sql`datetime('now')` })
      .where(and(eq(backbones.userId, userId), eq(backbones.isActive, 1)))
      .run();

    const created = await tx
      .insert(backbones)
      .values({
        userId,
        name: preset.name,
        description: preset.description,
        source: "custom",
        isActive: 1,
        foodOverspendCategoryId: null,
      })
      .run();
    const newBackboneId = Number(created.lastInsertRowid);

    const idMap = new Map<number, number>();
    for (const cat of presetCats) {
      const inserted = await tx
        .insert(backboneCategories)
        .values({
          backboneId: newBackboneId,
          name: cat.name,
          kind: cat.kind,
          percentBp: cat.percentBp,
          defaultForFood: cat.defaultForFood,
          sortOrder: cat.sortOrder,
        })
        .run();
      idMap.set(cat.id, Number(inserted.lastInsertRowid));
    }

    // The clone inherits the preset's overspend target (Wants where available).
    const overspendId = preset.foodOverspendCategoryId ? (idMap.get(preset.foodOverspendCategoryId) ?? null) : null;
    await tx
      .update(backbones)
      .set({ foodOverspendCategoryId: overspendId, updatedAt: sql`datetime('now')` })
      .where(eq(backbones.id, newBackboneId))
      .run();

    return requireActiveBackbone(tx, userId);
  });
}

/** Create a brand-new custom plan during onboarding (requirement 3). */
export async function createCustomBackbone(
  userId: number,
  name: string,
  categories: CategoryInput[],
  foodOverspendCategoryIndex: number,
): Promise<ActiveBackbone> {
  validateSpec(categories, foodOverspendCategoryIndex);

  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx
      .update(backbones)
      .set({ isActive: 0, updatedAt: sql`datetime('now')` })
      .where(and(eq(backbones.userId, userId), eq(backbones.isActive, 1)))
      .run();

    const created = await tx
      .insert(backbones)
      .values({ userId, name, source: "custom", isActive: 1, foodOverspendCategoryId: null })
      .run();
    const backboneId = Number(created.lastInsertRowid);

    const newIds: number[] = [];
    for (const [index, cat] of categories.entries()) {
      const inserted = await tx
        .insert(backboneCategories)
        .values({
          backboneId,
          name: cat.name.trim(),
          kind: cat.kind,
          percentBp: cat.percentBp,
          defaultForFood: cat.defaultForFood ? 1 : 0,
          sortOrder: index,
        })
        .run();
      newIds.push(Number(inserted.lastInsertRowid));
    }

    await tx
      .update(backbones)
      .set({ foodOverspendCategoryId: newIds[foodOverspendCategoryIndex], updatedAt: sql`datetime('now')` })
      .where(eq(backbones.id, backboneId))
      .run();

    return requireActiveBackbone(tx, userId);
  });
}

/** Replace/edit the active plan's categories in place (budget page). */
export async function updateActiveBackbone(
  userId: number,
  name: string | undefined,
  categories: CategoryInput[],
  foodOverspendCategoryIndex: number,
): Promise<ActiveBackbone> {
  validateSpec(categories, foodOverspendCategoryIndex);

  const db = await getDb();
  return db.transaction(async (tx) => {
    const active = await loadActiveBackbone(tx, userId);
    if (!active) throw new HttpError(403, "No active backbone.");

    const existingIds = active.categories.map((c) => c.id);
    const incomingIds = categories.map((c) => c.id).filter((id): id is number => typeof id === "number");

    for (const id of incomingIds) {
      if (!existingIds.includes(id)) {
        throw new HttpError(400, "One of those categories does not belong to your active backbone.");
      }
    }
    await assertRemovable(existingIds.filter((id) => !incomingIds.includes(id)), tx);

    const finalIds: number[] = [];
    for (const [index, cat] of categories.entries()) {
      if (typeof cat.id === "number") {
        await tx
          .update(backboneCategories)
          .set({
            name: cat.name.trim(),
            kind: cat.kind,
            percentBp: cat.percentBp,
            defaultForFood: cat.defaultForFood ? 1 : 0,
            sortOrder: index,
          })
          .where(eq(backboneCategories.id, cat.id))
          .run();
        finalIds.push(cat.id);
      } else {
        const inserted = await tx
          .insert(backboneCategories)
          .values({
            backboneId: active.backbone.id,
            name: cat.name.trim(),
            kind: cat.kind,
            percentBp: cat.percentBp,
            defaultForFood: cat.defaultForFood ? 1 : 0,
            sortOrder: index,
          })
          .run();
        finalIds.push(Number(inserted.lastInsertRowid));
      }
    }

    const removable = existingIds.filter((id) => !incomingIds.includes(id));
    if (removable.length > 0) {
      await tx.delete(backboneCategories).where(inArray(backboneCategories.id, removable)).run();
    }

    await tx
      .update(backbones)
      .set({
        ...(name ? { name } : {}),
        foodOverspendCategoryId: finalIds[foodOverspendCategoryIndex],
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(backbones.id, active.backbone.id))
      .run();

    return requireActiveBackbone(tx, userId);
  });
}

/* ------------------------------- food tracking -------------------------------- */

export type FoodDay = { date: string; spend: number; available: number; over: number };

export type FoodSummary = {
  dailyBudget: number;
  /** Month budget = dailyBudget × days in month. 0 only when dailyBudget is unset. */
  budget: number;
  spent: number;
  todaySpent: number;
  /** Unspent allowance carried into today (month-scoped). */
  carry: number;
  /** What today's food can spend: dailyBudget + carry. */
  availableToday: number;
  /** Month over-budget food, re-booked to the overspend target (requirement 6). */
  overspend: number;
  overspendToday: number;
  targetCategoryId: number | null;
  targetCategoryName: string | null;
};

type FoodTx = { id: number; amount: number; categoryId: number };

type FoodChain = {
  daily: number;
  budget: number;
  spent: number;
  todaySpent: number;
  carry: number;
  availableToday: number;
  overspend: number;
  overspendToday: number;
  days: FoodDay[];
  byDay: Map<string, FoodTx[]>;
};

/**
 * Walk the month day by day, compounding the carry chain:
 *   available(d) = daily + carry(d)      carry(d+1) = max(0, available(d) − spend(d))
 * Overspend is only counted on elapsed days (d ≤ days elapsed relative to `today`);
 * `today`'s available is what a user can actually spend right now.
 */
async function computeFoodChain(
  exec: Exec,
  active: ActiveBackbone,
  user: SessionUser,
  month: string,
  today: string,
): Promise<FoodChain> {
  const daily = user.settings?.dailyFoodBudget ?? 0;
  const dim = daysInMonth(month);
  const elapsed = daysElapsed(month, today);
  const inMonth = today.slice(0, 7) === month;

  const foodRows = await exec
    .select({
      id: transactions.id,
      amount: transactions.amount,
      spentOn: transactions.spentOn,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        eq(transactions.isFood, 1),
        like(transactions.spentOn, `${month}-%`),
      ),
    )
    .orderBy(transactions.spentOn, transactions.id)
    .all();

  const byDay = new Map<string, FoodTx[]>();
  let spent = 0;
  let todaySpent = 0;
  for (const row of foodRows) {
    const list = byDay.get(row.spentOn) ?? [];
    list.push({ id: row.id, amount: row.amount, categoryId: row.categoryId });
    byDay.set(row.spentOn, list);
    spent += row.amount;
    if (row.spentOn === today) todaySpent += row.amount;
  }

  const days: FoodDay[] = [];
  let carry = 0;
  let overspend = 0;
  let overspendToday = 0;
  let availableToday = 0;
  let carryToday = 0;
  for (let d = 1; d <= dim; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const list = byDay.get(date) ?? [];
    const daySpend = list.reduce((sum, tx) => sum + tx.amount, 0);
    const available = daily + carry;
    const over = daily > 0 && d <= elapsed ? Math.max(0, daySpend - available) : 0;
    days.push({ date, spend: daySpend, available, over });
    if (over > 0) {
      overspend += over;
      if (date === today) overspendToday = over;
    }
    if (date === today) {
      availableToday = available;
      carryToday = carry;
    }
    carry = Math.max(0, available - daySpend);
  }

  return {
    daily,
    budget: daily * dim,
    spent,
    todaySpent: inMonth ? todaySpent : 0,
    carry: inMonth ? carryToday : 0,
    availableToday: inMonth ? availableToday : 0,
    overspend,
    overspendToday: inMonth ? overspendToday : 0,
    days,
    byDay,
  };
}

function summarizeFood(active: ActiveBackbone, chain: FoodChain): FoodSummary {
  const target = active.backbone.foodOverspendCategoryId
    ? (active.categories.find((c) => c.id === active.backbone.foodOverspendCategoryId) ?? null)
    : null;
  return {
    dailyBudget: chain.daily,
    budget: chain.budget,
    spent: chain.spent,
    todaySpent: chain.todaySpent,
    carry: chain.carry,
    availableToday: chain.availableToday,
    overspend: chain.overspend,
    overspendToday: chain.overspendToday,
    targetCategoryId: target?.id ?? null,
    targetCategoryName: target?.name ?? null,
  };
}

/**
 * Requirement 6: re-book each elapsed day's over-budget food slice from the day's
 * own food transactions (in id order) to the plan's overspend target. Keeps every
 * category's spent equal to actual money; a day's overage = max(0, spend − available).
 */
function applyOverspendRebooking(
  active: ActiveBackbone,
  spentByCategory: Map<number, number>,
  chain: FoodChain,
): void {
  const targetId = active.backbone.foodOverspendCategoryId;
  if (targetId == null || chain.daily <= 0) return; // no daily budget → no chain/overspend
  for (const day of chain.days) {
    if (day.over <= 0) continue;
    const txs = chain.byDay.get(day.date) ?? [];
    let acc = 0;
    for (const tx of txs) {
      const kept = Math.max(0, Math.min(tx.amount, day.available - acc));
      const rebook = tx.amount - kept;
      if (rebook > 0) {
        spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) - rebook);
        spentByCategory.set(targetId, (spentByCategory.get(targetId) ?? 0) + rebook);
      }
      acc += tx.amount;
    }
  }
}

/* --------------------------------- overview ---------------------------------- */

export async function computeOverview(user: SessionUser, month: string, today: string) {
  const db = await getDb();
  const active = await loadActiveBackbone(db, user.id);
  if (!active) throw new HttpError(403, "Finish setting up your budget first.");

  const income = user.settings?.monthlyIncome ?? 0;
  const dim = daysInMonth(month);
  const elapsed = daysElapsed(month, today);

  const monthTx = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), like(transactions.spentOn, `${month}-%`)))
    .orderBy(desc(transactions.spentOn), desc(transactions.id))
    .all();

  const spentByCategory = new Map<number, number>();
  let totalSpent = 0;
  for (const tx of monthTx) {
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + tx.amount);
    totalSpent += tx.amount;
  }

  const chain = await computeFoodChain(db, active, user, month, today);
  applyOverspendRebooking(active, spentByCategory, chain);

  const categories = active.categories.map((cat) => {
    const allocated = Math.round((income * cat.percentBp) / TOTAL_PERCENT_BP);
    const spent = spentByCategory.get(cat.id) ?? 0;
    return {
      id: cat.id,
      name: cat.name,
      kind: cat.kind as CategoryKind,
      percentBp: cat.percentBp,
      defaultForFood: cat.defaultForFood === 1,
      isOverspendTarget: cat.id === active.backbone.foodOverspendCategoryId,
      allocated,
      spent,
      remaining: allocated - spent,
    };
  });

  const budgetTotal = categories.reduce((sum, c) => sum + c.allocated, 0);

  const recent = monthTx.slice(0, 6).map((tx) => ({
    id: tx.id,
    name: tx.name,
    amount: tx.amount,
    kind: tx.kind,
    isFood: tx.isFood === 1,
    spentOn: tx.spentOn,
    categoryId: tx.categoryId,
    categoryName: active.categories.find((c) => c.id === tx.categoryId)?.name ?? "—",
  }));

  return {
    month,
    today,
    income,
    daysInMonth: dim,
    daysElapsed: elapsed,
    daysLeft: dim - elapsed,
    totals: { budget: budgetTotal, spent: totalSpent, remaining: budgetTotal - totalSpent },
    categories,
    food: summarizeFood(active, chain),
    recent,
    backbone: {
      id: active.backbone.id,
      name: active.backbone.name,
      foodOverspendCategoryId: active.backbone.foodOverspendCategoryId,
    },
  };
}

/* -------------------------------- food page ---------------------------------- */

export async function computeFoodPage(user: SessionUser, month: string, today: string) {
  const db = await getDb();
  const active = await loadActiveBackbone(db, user.id);
  if (!active) throw new HttpError(403, "Finish setting up your budget first.");

  const chain = await computeFoodChain(db, active, user, month, today);
  const summary = summarizeFood(active, chain);

  const entries = await db
    .select({ tx: transactions, categoryName: backboneCategories.name })
    .from(transactions)
    .innerJoin(backboneCategories, eq(transactions.categoryId, backboneCategories.id))
    .where(
      and(eq(transactions.userId, user.id), eq(transactions.isFood, 1), like(transactions.spentOn, `${month}-%`)),
    )
    .orderBy(desc(transactions.spentOn), desc(transactions.id))
    .all();

  const categoryOptions = active.categories.map((c) => ({
    id: c.id,
    name: c.name,
    isDefault: c.defaultForFood === 1,
  }));

  return {
    month,
    today,
    ...summary,
    days: chain.days.map((d) => ({ date: d.date, spent: d.spend, available: d.available, over: d.over })),
    entries: entries.map((e) => ({
      id: e.tx.id,
      name: e.tx.name,
      amount: e.tx.amount,
      spentOn: e.tx.spentOn,
      note: e.tx.note,
      categoryId: e.tx.categoryId,
      categoryName: e.categoryName,
    })),
    categoryOptions,
  };
}
