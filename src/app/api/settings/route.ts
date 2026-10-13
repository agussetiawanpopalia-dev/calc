import { z } from "zod";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { handle, ok, readJson, publicUser } from "@/lib/api";
import { requireAuthedUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, userSettings } from "@/lib/schema";

export async function GET() {
  return handle(async () => {
    const user = await requireAuthedUser();
    return ok({ user: publicUser(user) });
  });
}

const schema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  locale: z.enum(["en", "id"]).optional(),
  monthlyIncome: z.number().int().min(0).max(10_000_000_000).optional(),
  dailyFoodBudget: z.number().int().min(0).max(10_000_000).optional(),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const body = await readJson(req, schema);
    const user = await requireAuthedUser();
    const db = await getDb();

    if (body.displayName !== undefined || body.locale !== undefined || body.phone !== undefined) {
      await db
        .update(users)
        .set({
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          updatedAt: sql`datetime('now')`,
        })
        .where(eq(users.id, user.id))
        .run();
    }

    const hasSettingsChange =
      body.monthlyIncome !== undefined || body.dailyFoodBudget !== undefined;
    if (hasSettingsChange) {
      await db
        .insert(userSettings)
        .values({
          userId: user.id,
          monthlyIncome: body.monthlyIncome ?? 0,
          dailyFoodBudget: body.dailyFoodBudget ?? 0,
        })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: {
            ...(body.monthlyIncome !== undefined ? { monthlyIncome: body.monthlyIncome } : {}),
            ...(body.dailyFoodBudget !== undefined ? { dailyFoodBudget: body.dailyFoodBudget } : {}),
            updatedAt: sql`datetime('now')`,
          },
        })
        .run();
    }

    if (body.locale) {
      const store = await cookies();
      store.set("mc_locale", body.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }

    const fresh = await requireAuthedUser();
    return ok({ user: publicUser(fresh) });
  });
}
