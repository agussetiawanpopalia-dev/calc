import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { requestOtp } from "@/lib/auth";

const emailSchema = z.string().email("Enter a valid email address.").max(120);

const schema = z.object({ email: emailSchema });

export async function POST(req: Request) {
  return handle(async () => {
    const { email } = await readJson(req, schema);
    const normalized = email.toLowerCase().trim();

    const result = await requestOtp(normalized);
    return ok({ email: normalized, ...result });
  });
}
