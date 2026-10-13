import { z } from "zod";
import { cookies } from "next/headers";
import { handle, ok, readJson, publicUser } from "@/lib/api";
import { verifyOtp, createSession, attachSessionCookie } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email address.").max(120),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { email, code } = await readJson(req, schema);
    const normalized = email.toLowerCase().trim();

    const user = await verifyOtp(normalized, code);
    const token = await createSession(user.id, req.headers.get("user-agent"));
    await attachSessionCookie(token);

    const store = await cookies();
    store.set("mc_locale", user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

    return ok({ user: publicUser(user), mustOnboard: !user.onboardedAt });
  });
}
