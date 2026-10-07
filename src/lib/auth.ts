import { randomBytes, createHash, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { users, sessions, otpCodes, userSettings, type User, type UserSettings } from "./schema";

export const SESSION_COOKIE = "mc_session";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

/** OTP delivery mode. 'dev' returns the code in the API response (draft for ~10 users, no SMS bill).
 *  Swap to 'sms' by providing a provider in the `deliverOtp` hook below — the flow doesn't change. */
const OTP_MODE = process.env.OTP_MODE ?? "dev";

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
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions)
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

  const row = db
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

  db.update(sessions).set({ lastSeenAt: sql`datetime('now')` }).where(eq(sessions.id, row.session.id)).run();

  const settings =
    db.select().from(userSettings).where(eq(userSettings.userId, row.user.id)).limit(1).get() ?? null;

  return { ...row.user, settings };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    db.update(sessions)
      .set({ revokedAt: sql`datetime('now')` })
      .where(eq(sessions.tokenHash, sha256(token)))
      .run();
  }
  store.delete(SESSION_COOKIE);
}

/* ------------------------------------- OTP ------------------------------------- */

export type RequestOtpResult = {
  delivery: "dev" | "sms";
  expiresInSeconds: number;
  /** Present only when delivery === 'dev' */
  devOtp?: string;
};

export function requestOtp(phone: string): RequestOtpResult {
  const latest = db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
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
  db.insert(otpCodes)
    .values({
      phone,
      code,
      expiresAt: sql`datetime('now', ${`+${OTP_MINUTES} minutes`})`,
    })
    .run();

  // Audit trail (backlog admin dashboard reads these later).
  console.log(`[otp] ${phone} -> ${code} (expires in ${OTP_MINUTES}m)`);

  if (OTP_MODE === "dev") {
    return { delivery: "dev", expiresInSeconds: OTP_MINUTES * 60, devOtp: code };
  }
  // TODO(sms): plug Twilio / WhatsApp Cloud API here — `code` is the message payload.
  throw new HttpError(501, "SMS delivery is not configured. Set OTP_MODE=dev for local drafts.");
}

export function verifyOtp(phone: string, code: string): SessionUser {
  const otp = db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
    .get();

  if (!otp) throw new HttpError(400, "No active code for this number. Request a new one.");
  if (otp.expiresAt <= nowSql()) throw new HttpError(400, "That code has expired. Request a new one.");
  if (otp.attempts >= otp.maxAttempts) throw new HttpError(400, "Too many attempts. Request a new code.");

  const a = Buffer.from(otp.code, "utf8");
  const b = Buffer.from(code, "utf8");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id)).run();
    const left = otp.maxAttempts - (otp.attempts + 1);
    throw new HttpError(401, left > 0 ? `Incorrect code. ${left} attempt(s) left.` : "Too many attempts.");
  }

  db.update(otpCodes).set({ consumedAt: sql`datetime('now')` }).where(eq(otpCodes.id, otp.id)).run();
  return upsertUserByPhone(phone);
}

/** Registration == first login with a phone number. Creates the user row if new. */
export function upsertUserByPhone(phone: string): SessionUser {
  let user = db.select().from(users).where(eq(users.phone, phone)).limit(1).get();

  if (!user) {
    const info = db.insert(users).values({ phone, lastLoginAt: sql`datetime('now')` }).run();
    user = db.select().from(users).where(eq(users.id, Number(info.lastInsertRowid))).limit(1).get()!;
  } else {
    db.update(users)
      .set({ lastLoginAt: sql`datetime('now')`, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, user.id))
      .run();
  }

  const settings =
    db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1).get() ?? null;

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
