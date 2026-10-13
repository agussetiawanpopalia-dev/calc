"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Segmented, TextInput } from "@/components/ui";

type RequestOtpResponse = {
  ok: boolean;
  email: string;
  delivery: "dev" | "email";
  expiresInSeconds: number;
  devOtp?: string;
};

type VerifyResponse = { ok: boolean; user: { onboarded: boolean }; mustOnboard: boolean };

export function LoginForm() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submitEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<RequestOtpResponse>("/api/auth/request-otp", { method: "POST", body: { email } });
      setDevOtp(result.devOtp ?? null);
      setCooldown(60);
      setStep("code");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<VerifyResponse>("/api/auth/verify-otp", { method: "POST", body: { email, code } });
      router.push(result.mustOnboard ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.invalidCode"));
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--color-accent)] uppercase">
            {t("app.name")}
          </p>
          <h1 className="mt-2 text-[30px] leading-tight font-bold tracking-[-0.02em]">
            {step === "email" ? t("login.title") : t("login.codeTitle")}
          </h1>
          <p className="mt-2 text-[16px] text-[var(--color-ink-2)]">
            {step === "email" ? t("login.subtitle") : t("login.codeSent", { contact: email })}
          </p>
        </div>
        <Segmented
          options={[
            { value: "en", label: "EN" },
            { value: "id", label: "ID" },
          ]}
          value={locale}
          onChange={(value) => setLocale(value)}
        />
      </div>

      <Card className="p-5" glass="regular">
        {step === "email" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitEmail();
            }}
          >
            <label className="block">
              <span className="mb-1.5 block px-1 text-[15px] font-medium text-[var(--color-ink-2)]">
                {t("login.email")}
              </span>
              <TextInput
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <p className="px-1 text-[14px] text-[var(--color-red)]">{error}</p>}
            <Button type="submit" loading={loading} full>
              {loading ? t("login.sending") : t("login.sendCode")}
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            <TextInput
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="input text-center text-[28px] font-semibold tracking-[0.4em] tabular-nums"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            {devOtp && (
              <p className="rounded-xl bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-3 py-2.5 text-center text-[14px] text-[var(--color-accent)]">
                {t("login.devCode", { code: devOtp })}
              </p>
            )}
            {error && <p className="px-1 text-[14px] text-[var(--color-red)]">{error}</p>}
            <Button type="submit" loading={loading} full disabled={code.length !== 6}>
              {loading ? t("login.verifying") : t("login.verify")}
            </Button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="press text-[15px] font-medium text-[var(--color-ink-2)]"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                {t("login.back")}
              </button>
              <button
                type="button"
                className="press text-[15px] font-medium text-[var(--color-accent)] disabled:opacity-40"
                disabled={cooldown > 0}
                onClick={() => void submitEmail()}
              >
                {cooldown > 0 ? t("login.resendIn", { s: cooldown }) : t("login.resend")}
              </button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}