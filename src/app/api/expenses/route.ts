import { z } from "zod";
import { and, desc, eq, like } from "drizzle-orm";
import { handle, ok, readJson } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions, backboneCategories } from "@/lib/schema";
import { getActiveBackbone } from "@/lib/budget";
import { isValidMonth, isValidDate, monthKey } from "@/lib/dates";

const createSchema = z.object({
  name: z.string().trim().min(1, "The expense needs a name.").max(80),
  amount: z.number().int().min(1, "Amount must be more than 0.").max(10_000_000_000),
  spentOn: z.string().refine(isValidDate, "Date must be YYYY-MM-DD."),
  categoryId: z.number().int().positive("Every expense links to a backbone category."),
  isFood: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

/** All transactions for a month (food included) — the expenses list. */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");
    const month = monthParam && isValidMonth(monthParam) ? monthParam : monthKey(new Date());
    const user = await requireUser();

    const rows = db
      .select({ tx: transactions, categoryName: backboneCategories.name })
      .from(transactions)
      .innerJoin(backboneCategories, eq(transactions.categoryId, backboneCategories.id))
      .where(and(eq(transactions.userId, user.id), like(transactions.spentOn, `${month}-%`)))
      .orderBy(desc(transactions.spentOn), desc(transactions.id))
      .all();

    const total = rows.reduce((sum, row) => sum + row.tx.amount, 0);
    return ok({
      month,
      total,
      expenses: rows.map((row) => ({
        id: row.tx.id,
        name: row.tx.name,
        amount: row.tx.amount,
        kind: row.tx.kind,
        isFood: row.tx.isFood === 1,
        spentOn: row.tx.spentOn,
        note: row.tx.note,
        categoryId: row.tx.categoryId,
        categoryName: row.categoryName,
      })),
    });
  });
}

/** Add an expense — always linked to a backbone child (requirement 4, enforced server-side). */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, createSchema);
    const user = await requireUser();

    const active = getActiveBackbone(user.id);
    if (!active) throw new HttpError(403, "Finish setting up your budget first.");
    const category = active.categories.find((c) => c.id === body.categoryId);
    if (!category) {
      throw new HttpError(400, "That category is not part of your active backbone. Pick one of yours.");
    }

    const id = db
      .insert(transactions)
      .values({
        userId: user.id,
        categoryId: body.categoryId,
        kind: "expense",
        name: body.name,
        amount: body.amount,
        isFood: body.isFood ? 1 : 0,
        spentOn: body.spentOn,
        note: body.note ?? null,
      })
      .run().lastInsertRowid;

    return ok({ id: Number(id) }, 201);
  });
}
