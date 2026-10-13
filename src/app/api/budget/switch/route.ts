import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clonePresetToUser, serializeBackbone } from "@/lib/budget";

const schema = z.object({ presetId: z.number().int().positive() });

/** Switch to a preset backbone. The preset is cloned as your own so you can edit it;
 *  the previous backbone stays archived (its expenses keep their links). */
export async function POST(req: Request) {
  return handle(async () => {
    const { presetId } = await readJson(req, schema);
    const user = await requireUser();
    const active = await clonePresetToUser(user.id, presetId);
    return ok({ backbone: serializeBackbone(active) });
  });
}
