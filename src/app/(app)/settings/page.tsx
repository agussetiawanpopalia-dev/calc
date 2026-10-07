"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, useApi } from "@/lib/client";
import type { PublicUser } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Button, Card, Chip, Row, SectionTitle, Segmented, Spinner, TextInput } from "@/components/ui";

export default function SettingsPage() {
  const { t, money, locale, setLocale } = useI18n();
  const router = useRouter();
  const me = useApi<{ user: PublicUser | null }>("/api/me");
  const user = me.data?.user;

  const [name, setName] = useState("");
  const [income, setIncome] = useState("");
  const [dailyFood, setDailyFood] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Seed the form from the fetched profile — render-phase adjustment (not an effect),
  // so a refetch after save re-syncs just like a sync-from-props would.
  const [syncedUser, setSyncedUser] = useState<PublicUser | null>(null);
  if (user && user !== syncedUser) {
    setSyncedUser(user);
    setName(user.displayName ?? "");
    setIncome(user.settings.monthlyIncome ? String(user.settings.monthlyIncome) : "");
    setDailyFood(user.settings.dailyFoodBudget ? String(user.settings.dailyFoodBudget) : "");
  }

  const dailyFoodValue = Number(dailyFood.replace(/\D/g, "")) || 0;
  const monthlyFoodApprox = dailyFoodValue * 30;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: {
          displayName: name.trim() || undefined,
          locale,
          monthlyIncome: Number(income.replace(/\D/g, "")) || 0,
          dailyFoodBudget: dailyFoodValue,
        },
      });
      setSaved(true);
      me.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  if (me.loading && !user) {
    return (
      <>
        <PageHeader title={t("set.title")} />
        <div className="flex justify-center py-16 text-[var(--color-ink-2)]">
          <Spinner className="h-6 w-6" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("set.title")}
        right={user?.role === "admin" ? <Chip tone="accent">Admin</Chip> : undefined}
      />

      <div className="flex flex-col gap-5">
        {user?.role === "admin" && (
          <Card className="p-5 text-[14px] text-[var(--color-ink-2)]">{t("set.adminNote")}</Card>
        )}

        <section>
          <SectionTitle>{t("set.profile")}</SectionTitle>
          <Card className="divide-y divide-[var(--color-hair)]">
            <Row label={t("set.name")}>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("setup.namePlaceholder")}
                className="input !w-[180px] text-right"
              />
            </Row>
            <Row label={t("set.phone")}>
              <span className="text-[16px] text-[var(--color-ink-2)] tabular-nums">{user?.phone}</span>
            </Row>
            <Row label={t("set.language")}>
              <div className="w-[176px]">
                <Segmented
                  options={[
                    { value: "en", label: "EN" },
                    { value: "id", label: "ID" },
                  ]}
                  value={locale}
                  onChange={(value) => setLocale(value)}
                />
              </div>
            </Row>
          </Card>
        </section>

        <section>
          <SectionTitle>{t("set.numbers")}</SectionTitle>
          <Card className="divide-y divide-[var(--color-hair)]">
            <Row label={t("set.income")}>
              <TextInput
                inputMode="numeric"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="6000000"
                className="input !w-[160px] text-right tabular-nums"
              />
            </Row>
            <Row label={t("set.dailyFood")}>
              <div className="flex flex-col items-end gap-1">
                <TextInput
                  inputMode="numeric"
                  value={dailyFood}
                  onChange={(e) => setDailyFood(e.target.value)}
                  placeholder="40000"
                  className="input !w-[160px] text-right tabular-nums"
                />
                  <span className="text-[13px] text-[var(--color-ink-2)] tabular-nums">
                    {t("set.monthlyApprox", { amount: money(monthlyFoodApprox) })}
                  </span>
              </div>
            </Row>
          </Card>
        </section>

        {error && <p className="text-[14px] text-[var(--color-red)]">{error}</p>}

        <div className="flex flex-col gap-3">
          <Button full loading={saving} onClick={() => void save()}>
            {saved ? `✓ ${t("set.saved")}` : saving ? t("common.saving") : t("set.save")}
          </Button>
          <Button variant="secondary" full loading={signingOut} onClick={() => void signOut()}>
            {signingOut ? t("set.signingOut") : t("set.signOut")}
          </Button>
        </div>
      </div>
    </>
  );
}
