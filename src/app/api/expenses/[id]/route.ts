import { and, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

/** Delete an expense (owner only). */
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) throw new HttpError(400, "Invalid expense id.");

    const row = db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, numericId), eq(transactions.userId, user.id)))
      .limit(1)
      .get();
    if (!row) throw new HttpError(404, "Expense not found.");

    db.delete(transactions).where(eq(transactions.id, numericId)).run();
    return ok({ id: numericId });
  });
}
