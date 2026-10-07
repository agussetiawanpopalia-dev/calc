import { handle, ok, publicUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getActiveBackbone, serializeBackbone } from "@/lib/budget";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return ok({ user: null });
    const active = getActiveBackbone(user.id);
    return ok({
      user: publicUser(user),
      backbone: active ? serializeBackbone(active) : null,
    });
  });
}
