import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/dashboard");
  return <OnboardingForm initialName={user.displayName ?? ""} initialEmail={user.email ?? ""} />;
}
