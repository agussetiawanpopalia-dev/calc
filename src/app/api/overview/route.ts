import { handle, ok } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { computeOverview } from "@/lib/budget";
import { isValidMonth, isValidDate, monthKey, todayISO } from "@/lib/dates";

/** Month overview: backbone budget vs actual, food tracker status, recent activity. */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const todayParam = url.searchParams.get("date");
    const today = todayParam && isValidDate(todayParam) ? todayParam : todayISO();
    const monthParam = url.searchParams.get("month");
    const month = monthParam && isValidMonth(monthParam) ? monthParam : monthKey(new Date(`${today}T00:00:00`));
    if (!isValidMonth(month)) throw new HttpError(400, "Invalid month. Use YYYY-MM.");

    const user = await requireUser();
    return ok({ overview: await computeOverview(user, month, today) });
  });
}
