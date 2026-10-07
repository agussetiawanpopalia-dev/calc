import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TabBar } from "@/components/tab-bar";

/** Guarded shell for all signed-in, onboarded pages. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pb-safe">{children}</div>
      <TabBar />
    </>
  );
}
