"use client";

import Link from "next/link";
import { localToday, useApi } from "@/lib/client";
import type { Overview } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Card, Chip, EmptyState, ProgressBar, SectionTitle, Spinner } from "@/components/ui";
import { ForkIcon } from "@/components/icons";

export default function DashboardPage() {
  const { t, money, monthLabel } = useI18n();
  const today = localToday();
  const { data, error, loading } = useApi<{ overview: Overview }>(`/api/overview?date=${today}`);
  const me = useApi<{ user: { displayName: string | null } | null }>("/api/me");

  const overview = data?.overview;
  const month = overview?.month ?? today.slice(0, 7);
  const displayName = me.data?.user?.displayName ?? "";
  const greeting = displayName ? t("dash.greeting", { name: displayName }) : t("dash.greetingAnon");

  if (loading && !overview) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--color-ink-2)]">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <>
        <PageHeader title={t("nav.dashboard")} />
        <EmptyState title={error ?? t("common.error")} />
      </>
    );
  }

  const budgetPct = overview.totals.budget > 0 ? overview.totals.spent / overview.totals.budget : 0;
  const food = overview.food;
  const foodRefProgress = food.availableToday > 0 ? food.todaySpent / food.availableToday : 0;

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={monthLabel(month)}
        right={
          <Chip tone={overview.daysLeft <= 5 ? "orange" : "neutral"}>
            {t("dash.daysLeft", { n: overview.daysLeft })}
          </Chip>
        }
      />

      {/* monthly budget summary */}
      <Card glass="regular" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.05em] text-[var(--color-ink-2)] uppercase">
              {t("dash.remaining")}
            </p>
            <p className="mt-1 text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">
              {money(overview.totals.remaining)}
            </p>
            <p className="mt-1.5 text-[14px] text-[var(--color-ink-2)]">
              {t("dash.spent")} {money(overview.totals.spent)} · {t("dash.budget")} {money(overview.totals.budget)}
            </p>
          </div>
          <Link href="/budget">
            <Chip tone="accent">{overview.backbone.name}</Chip>
          </Link>
        </div>
        <div className="mt-4">
          <ProgressBar value={budgetPct} tone={budgetPct > 1 ? "red" : budgetPct > 0.85 ? "orange" : "accent"} />
        </div>
      </Card>

      {/* food today — present, but compact (requirement 5); whole card opens /food (requirement) */}
      <Card glass="regular" className="relative mt-4 p-5">
        <Link
          href="/food"
          aria-label={t("dash.foodOpen")}
          className="absolute inset-0 z-0 rounded-[20px]"
        />
        <div className="pointer-events-none relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-green)_16%,transparent)] text-[var(--color-green)]">
              <ForkIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-ink-2)]">{t("dash.foodTitle")}</p>
              <p className="text-[17px] font-semibold tabular-nums tracking-tight">
                {t("dash.foodOfRef", { spent: money(food.todaySpent), ref: money(food.availableToday) })}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar
              value={foodRefProgress}
              tone={foodRefProgress > 1 ? "red" : foodRefProgress > 0.9 ? "orange" : "green"}
            />
          </div>
          <div className="mt-2 min-h-[18px]">
            {food.budget > 0 ? (
              <p className="text-[13px] text-[var(--color-ink-2)] tabular-nums">
                {t("dash.foodMonth", { spent: money(food.spent), budget: money(food.budget) })}
                {food.overspend > 0 && food.targetCategoryName && (
                  <span className="text-[var(--color-orange)]">
                    {" · "}
                    {t("dash.overspendNote", { amount: money(food.overspend), category: food.targetCategoryName })}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-[var(--color-accent)]">{t("dash.foodNoBudget")}</p>
            )}
          </div>
          {food.carry > 0 && (
            <p className="mt-1 text-[12px] font-semibold text-[var(--color-green)] tabular-nums">
              {t("food.carry", { amount: money(food.carry) })}
            </p>
          )}
        </div>
      </Card>

      {/* backbone categories */}
      <section className="mt-6">
        <SectionTitle>{t("dash.byCategory")}</SectionTitle>
        <Card className="divide-y divide-[var(--color-hair)]">
          {overview.categories.map((category) => {
            const pct = category.allocated > 0 ? category.spent / category.allocated : 0;
            return (
              <div key={category.id} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[16px] font-medium">{category.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--color-ink-3)]">
                      {category.percentBp / 100}%
                    </span>
                    {category.isOverspendTarget && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--color-orange)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-orange-ink)]">
                        {t("budget.overspendTarget")}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[16px] font-semibold tabular-nums tracking-tight">
                    {money(category.remaining)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={pct} tone={pct > 1 ? "red" : pct > 0.9 ? "orange" : "accent"} />
                </div>
                <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)] tabular-nums">
                  {t("dash.allocated", { amount: money(category.allocated) })} · {t("dash.spent")}{" "}
                  {money(category.spent)}
                  {pct > 1 && ` · ${t("dash.overBudget")}`}
                </p>
              </div>
            );
          })}
        </Card>
      </section>

    </>
  );
}