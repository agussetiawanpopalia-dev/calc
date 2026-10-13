import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";
import { requestOtp, HttpError } from "@/lib/auth";

const schema = z.object({ phone: z.string().min(1).max(30) });

export async function POST(req: Request) {
  return handle(async () => {
    const { phone } = await readJson(req, schema);
    const normalized = normalizePhone(phone);
    if (!normalized) throw new HttpError(400, "That phone number does not look valid. Try e.g. 0812 3456 7890.");

    const result = await requestOtp(normalized);
    return ok({ phone: normalized, ...result });
  });
}
