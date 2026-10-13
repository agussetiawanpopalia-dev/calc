import { randomBytes, createHash, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, sessions, otpCodes, userSettings, type User, type UserSettings } from "./schema";

export const SESSION_COOKIE = "mc_session";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

/** OTP delivery mode.
 * - 'dev': returns code in API response (local dev only)
 * - 'email': sends OTP via Resend (production)
 * Set OTP_MODE=email and RESEND_API_KEY in production. */
const OTP_MODE = (process.env.OTP_MODE as "dev" | "email") ?? "dev";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "MoneyCalc <otp@localhost>";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/* ---------------------------------- sessions ---------------------------------- */

export async function createSession(userId: number, userAgent?: string | null): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: sha256(token),
      userAgent: userAgent?.slice(0, 200) ?? null,
      expiresAt: sql`datetime('now', ${`+${SESSION_DAYS} days`})`,
    })
    .run();
  return token;
}

export async function attachSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export type SessionUser = User & { settings: UserSettings | null };

/** Returns the logged-in user (with settings) or null. Updates session liveness. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`datetime('now')`),
        eq(users.status, "active"),
      ),
    )
    .limit(1)
    .get();

  if (!row) return null;

  await db
    .update(sessions)
    .set({ lastSeenAt: sql`datetime('now')` })
    .where(eq(sessions.id, row.session.id))
    .run();

  const settings =
    (await db.select().from(userSettings).where(eq(userSettings.userId, row.user.id)).limit(1).get()) ?? null;

  return { ...row.user, settings };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db
      .update(sessions)
      .set({ revokedAt: sql`datetime('now')` })
      .where(eq(sessions.tokenHash, sha256(token)))
      .run();
  }
  store.delete(SESSION_COOKIE);
}

/* ------------------------------------- OTP ------------------------------------- */

export type RequestOtpResult = {
  delivery: "dev" | "email";
  expiresInSeconds: number;
  /** Present only when delivery === 'dev' */
  devOtp?: string;
};

export async function requestOtp(email: string): Promise<RequestOtpResult> {
  const db = await getDb();
  const latest = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.email, email))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
    .get();

  if (latest) {
    const cooldownLeft = secondsSince(latest.createdAt, RESEND_COOLDOWN_SECONDS);
    if (cooldownLeft > 0) {
      throw new HttpError(429, `Please wait ${cooldownLeft}s before requesting a new code.`);
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db
    .insert(otpCodes)
    .values({
      email,
      code,
      expiresAt: sql`datetime('now', ${`+${OTP_MINUTES} minutes`})`,
    })
    .run();

  // Audit trail (backlog admin dashboard reads these later).
  console.log(`[otp] ${email} -> ${code} (expires in ${OTP_MINUTES}m)`);

  if (OTP_MODE === "dev") {
    return { delivery: "dev", expiresInSeconds: OTP_MINUTES * 60, devOtp: code };
  }

  if (OTP_MODE === "email") {
    if (!RESEND_API_KEY) {
      throw new HttpError(500, "Email delivery not configured (missing RESEND_API_KEY).");
    }

    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: "Your MoneyCalc sign-in code",
      html: `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a;">
    <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">MoneyCalc</h1>
      <p style="font-size: 16px; margin-bottom: 24px;">Your sign-in code:</p>
      <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'SF Mono', Monaco, monospace;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #666;">This code expires in ${OTP_MINUTES} minutes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body>
</html>`,
    });

    if (error) {
      console.error("[resend] send error:", error);
      throw new HttpError(500, "Failed to send email. Please try again.");
    }

    return { delivery: "email", expiresInSeconds: OTP_MINUTES * 60 };
  }

  throw new HttpError(501, "OTP delivery not configured. Set OTP_MODE=dev or OTP_MODE=email.");
}

export async function verifyOtp(email: string, code: string): Promise<SessionUser> {
  const db = await getDb();
  const otp = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
    .get();

  if (!otp) throw new HttpError(400, "No active code for this email. Request a new one.");
  if (otp.expiresAt <= nowSql()) throw new HttpError(400, "That code has expired. Request a new one.");
  if (otp.attempts >= otp.maxAttempts) throw new HttpError(400, "Too many attempts. Request a new code.");

  const a = Buffer.from(otp.code, "utf8");
  const b = Buffer.from(code, "utf8");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id)).run();
    const left = otp.maxAttempts - (otp.attempts + 1);
    throw new HttpError(401, left > 0 ? `Incorrect code. ${left} attempt(s) left.` : "Too many attempts.");
  }

  await db.update(otpCodes).set({ consumedAt: sql`datetime('now')` }).where(eq(otpCodes.id, otp.id)).run();
  return upsertUserByEmail(email);
}

/** Registration == first login with an email. Creates the user row if new. */
export async function upsertUserByEmail(email: string): Promise<SessionUser> {
  const db = await getDb();
  let user = await db.select().from(users).where(eq(users.email, email)).limit(1).get();

  if (!user) {
    const info = await db.insert(users).values({ email, lastLoginAt: sql`datetime('now')` }).run();
    user = (await db
      .select()
      .from(users)
      .where(eq(users.id, Number(info.lastInsertRowid)))
      .limit(1)
      .get())!;
  } else {
    await db
      .update(users)
      .set({ lastLoginAt: sql`datetime('now')`, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, user.id))
      .run();
  }

  const settings =
    (await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1).get()) ?? null;

  return { ...user, settings };
}

/* ----------------------------------- helpers ----------------------------------- */

/** sqlite datetime('now') string for comparisons against TEXT columns */
export function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** Seconds still to wait until `createdAt + cooldownSeconds` */
function secondsSince(createdAt: string, cooldownSeconds: number): number {
  const createdMs = Date.parse(`${createdAt.replace(" ", "T")}Z`);
  const elapsed = (Date.now() - createdMs) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
}

/** Guard for API routes: returns the user or throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not signed in.");
  if (!user.onboardedAt) throw new HttpError(403, "Account setup incomplete.");
  return user;
}

/** Guard for API routes that must run before onboarding finishes. */
export async function requireAuthedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not signed in.");
  return user;
}
