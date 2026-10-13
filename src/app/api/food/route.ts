import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { computeFoodPage, getActiveBackbone } from "@/lib/budget";
import { isValidMonth, isValidDate, monthKey, todayISO } from "@/lib/dates";

/** Daily food tracker: per-day breakdown, entries, daily-budget chain and
 *  overspend status (the chain is computed per view — no posting ledger). */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const todayParam = url.searchParams.get("date");
    const today = todayParam && isValidDate(todayParam) ? todayParam : todayISO();
    const monthParam = url.searchParams.get("month");
    const month = monthParam && isValidMonth(monthParam) ? monthParam : monthKey(new Date(`${today}T00:00:00`));

    const user = await requireUser();
    return ok({ food: await computeFoodPage(user, month, today) });
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "The meal needs a name.").max(80),
  amount: z.number().int().min(1, "Amount must be more than 0.").max(10_000_000),
  spentOn: z.string().refine(isValidDate, "Date must be YYYY-MM-DD."),
  categoryId: z.number().int().positive().optional(),
});

/** Quick-add a daily food entry. Links to the backbone category (rule 4);
 *  defaults to the backbone's "default for food" child, e.g. Needs. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, createSchema);
    const user = await requireUser();
    const db = await getDb();

    const active = await getActiveBackbone(user.id);
    if (!active) throw new HttpError(403, "Finish setting up your budget first.");

    let categoryId = body.categoryId;
    if (categoryId) {
      if (!active.categories.some((c) => c.id === categoryId)) {
        throw new HttpError(400, "That category is not part of your active backbone.");
      }
    } else {
      const defaultCategory =
        active.categories.find((c) => c.defaultForFood === 1) ?? active.categories[0];
      categoryId = defaultCategory.id;
    }

    const id = (
      await db
        .insert(transactions)
        .values({
          userId: user.id,
          categoryId: categoryId!,
          kind: "expense",
          name: body.name,
          amount: body.amount,
          isFood: 1,
          spentOn: body.spentOn,
          note: null,
        })
        .run()
    ).lastInsertRowid;

    return ok({ id: Number(id) }, 201);
  });
}
