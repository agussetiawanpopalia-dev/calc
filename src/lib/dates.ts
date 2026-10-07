/** Date/month helpers. All API dates are plain 'YYYY-MM-DD' strings in the user's local timezone
 * (the browser always sends its own "today" so the server never guesses the timezone). */

export type MonthKey = string; // 'YYYY-MM'

export function isValidMonth(month: string): month is MonthKey {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

/** How many days of `month` have elapsed relative to `today` (clamped to the month). */
export function daysElapsed(month: MonthKey, today: string): number {
  const total = daysInMonth(month);
  if (today.slice(0, 7) < month) return 0;
  if (today.slice(0, 7) > month) return total;
  return Math.min(total, Number(today.slice(8, 10)));
}

export function daysLeft(month: MonthKey, today: string): number {
  return Math.max(0, daysInMonth(month) - daysElapsed(month, today));
}

export function eachDateInMonth(month: MonthKey): string[] {
  const total = daysInMonth(month);
  return Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
