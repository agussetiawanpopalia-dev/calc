import { z } from "zod";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { handle, ok, readJson, publicUser } from "@/lib/api";
import { requireAuthedUser, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, userSettings } from "@/lib/schema";
import { clonePresetToUser, createCustomBackbone } from "@/lib/budget";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Every category needs a name.").max(40),
  kind: z.enum(["needs", "wants", "savings", "debt", "other"]),
  percentBp: z.number().int().min(1, "Percent must be at least 1%.").max(10_000),
  defaultForFood: z.boolean(),
});

const schema = z.object({
  displayName: z.string().trim().min(1, "What should we call you?").max(60),
  locale: z.enum(["en", "id"]),
  monthlyIncome: z.number().int().min(0).max(10_000_000_000),
  dailyFoodBudget: z.number().int().min(0).max(10_000_000),
  backbone: z.object({
    presetId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(50).optional(),
    categories: z.array(categorySchema).max(12).optional(),
    foodOverspendCategoryIndex: z.number().int().min(0).optional(),
  }),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, schema);
    const user = await requireAuthedUser();
    if (user.onboardedAt) throw new HttpError(400, "This account is already set up.");
    const db = await getDb();

    // 1. Backbone FIRST: preset clone OR custom (validated: sums to 100%,
    // overspend target chosen). If validation fails here, the account is left
    // untouched so onboarding can simply be retried.
    const { presetId, name, categories, foodOverspendCategoryIndex } = body.backbone;
    if (typeof presetId === "number") {
      await clonePresetToUser(user.id, presetId);
    } else if (categories && name && typeof foodOverspendCategoryIndex === "number") {
      await createCustomBackbone(user.id, name, categories, foodOverspendCategoryIndex);
    } else {
      throw new HttpError(
        400,
        "Pick a preset plan, or fill in your own: name, categories totalling 100%, and a food overspend target.",
      );
    }

    // 2. Profile + numbers — mark onboarded only after the backbone exists
    await db
      .update(users)
      .set({
        displayName: body.displayName,
        locale: body.locale,
        onboardedAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(users.id, user.id))
      .run();

    await db
      .insert(userSettings)
      .values({
        userId: user.id,
        monthlyIncome: body.monthlyIncome,
        dailyFoodBudget: body.dailyFoodBudget,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          monthlyIncome: body.monthlyIncome,
          dailyFoodBudget: body.dailyFoodBudget,
          updatedAt: sql`datetime('now')`,
        },
      })
      .run();

    const store = await cookies();
    store.set("mc_locale", body.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

    const fresh = await requireAuthedUser();
    return ok({ user: publicUser(fresh) });
  });
}
