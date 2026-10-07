import { handle, ok } from "@/lib/api";
import { listPresets } from "@/lib/budget";

/** Preset backbone templates available during account creation / switching. */
export async function GET() {
  return handle(async () => {
    const presets = listPresets().map((preset) => ({
      id: preset.id,
      slug: preset.slug,
      name: preset.name,
      description: preset.description,
      categories: preset.categories.map((c) => ({
        name: c.name,
        kind: c.kind,
        percentBp: c.percentBp,
      })),
      foodOverspendCategoryId: preset.foodOverspendCategoryId,
    }));
    return ok({ presets });
  });
}
