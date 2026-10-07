import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError, type SessionUser } from "./auth";

/** Client-safe user shape (never leaks token/session details). */
export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    locale: user.locale,
    onboarded: Boolean(user.onboardedAt),
    settings: {
      monthlyIncome: user.settings?.monthlyIncome ?? 0,
      dailyFoodBudget: user.settings?.dailyFoodBudget ?? 0,
      currency: user.settings?.currency ?? "IDR",
    },
  };
}

/** Success envelope: { ok: true, ...payload } */
export function ok<T extends object>(payload: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

/** Error envelope: { ok: false, error } */
export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Route wrapper: maps HttpError/ZodError to clean JSON errors, logs the rest. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    if (error instanceof ZodError) return fail(error.issues[0]?.message ?? "Invalid input.", 400);
    console.error("[api] unhandled:", error);
    return fail("Something went wrong.", 500);
  }
}

/** Parse + validate a JSON request body. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}

/** Read a validated query param. */
export function searchParam(url: URL, name: string): string | null {
  return url.searchParams.get(name);
}
