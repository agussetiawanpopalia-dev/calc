import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user?.onboardedAt) redirect("/dashboard");
  if (user) redirect("/onboarding");
  return <LoginForm />;
}
