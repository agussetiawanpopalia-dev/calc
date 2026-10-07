import { z } from "zod";
import { cookies } from "next/headers";
import { handle, ok, readJson, publicUser } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";
import { verifyOtp, createSession, attachSessionCookie, HttpError } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(1).max(30),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { phone, code } = await readJson(req, schema);
    const normalized = normalizePhone(phone);
    if (!normalized) throw new HttpError(400, "That phone number does not look valid.");

    const user = verifyOtp(normalized, code);
    const token = await createSession(user.id, req.headers.get("user-agent"));
    await attachSessionCookie(token);

    const store = await cookies();
    store.set("mc_locale", user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

    return ok({ user: publicUser(user), mustOnboard: !user.onboardedAt });
  });
}
