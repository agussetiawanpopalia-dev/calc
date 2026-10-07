import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import {
  getActiveBackbone,
  listPresets,
  serializeBackbone,
  updateActiveBackbone,
} from "@/lib/budget";

/** Active backbone + presets (for switching / comparison). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const active = getActiveBackbone(user.id);
    if (!active) throw new HttpError(403, "Finish setting up your budget first.");

    const presets = listPresets().map((preset) => ({
      id: preset.id,
      slug: preset.slug,
      name: preset.name,
      description: preset.description,
      categories: preset.categories.map((c) => ({ name: c.name, kind: c.kind, percentBp: c.percentBp })),
    }));

    return ok({ backbone: serializeBackbone(active), presets });
  });
}

const categorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Every category needs a name.").max(40),
  kind: z.enum(["needs", "wants", "savings", "debt", "other"]),
  percentBp: z.number().int().min(1, "Percent must be at least 1%.").max(10_000),
  defaultForFood: z.boolean(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  categories: z.array(categorySchema).min(1, "Add at least one category.").max(12),
  foodOverspendCategoryIndex: z.number().int().min(0),
});

/** Edit the active plan: names, kinds, percentages (must total 100%),
 *  food-default category, and the mandatory food overspend target. */
export async function PUT(req: Request) {
  return handle(async () => {
    const body = await readJson(req, updateSchema);
    const user = await requireUser();

    const updated = updateActiveBackbone(
      user.id,
      body.name,
      body.categories,
      body.foodOverspendCategoryIndex,
    );
    return ok({ backbone: serializeBackbone(updated) });
  });
}
