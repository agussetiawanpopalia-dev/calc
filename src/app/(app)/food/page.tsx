"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, localMonth, localToday, useApi } from "@/lib/client";
import type { FoodPage as FoodPageData } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { MonthNav } from "@/components/month-nav";
import { Button, Card, Chip, EmptyState, ProgressBar, SectionTitle, Spinner, TextInput } from "@/components/ui";
import { AmountKeypad } from "@/components/amount-keypad";
import { Sheet } from "@/components/sheet";
import { PlusIcon, TrashIcon } from "@/components/icons";

export default function FoodPage() {
  const { t, money, monthLabel, dayLabel, weekdayLabel } = useI18n();
  const today = localToday();
  const [month, setMonth] = useState(localMonth());
  const { data, error, loading, refetch } = useApi<{ food: FoodPageData }>(
    `/api/food?month=${month}&date=${today}`,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const food = data?.food;

  const visibleEntries = useMemo(() => {
    const entries = food?.entries ?? [];
    return selectedDay ? entries.filter((entry) => entry.spentOn === selectedDay) : entries;
  }, [food, selectedDay]);

  const monthSpentPct = food && food.budget > 0 ? food.spent / food.budget : 0;

  const removeEntry = async (id: number) => {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    try {
      await api(`/api/expenses/${id}`, { method: "DELETE" });
      refetch();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("food.title")}
        subtitle={monthLabel(month)}
        right={
          <div className="flex items-center gap-2">
            <MonthNav month={month} onChange={setMonth} />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="press grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)] text-white"
              aria-label={t("food.add")}
            >
              <PlusIcon size={20} />
            </button>
          </div>
        }
      />

      {loading && !food ? (
        <div className="flex justify-center py-16 text-[var(--color-ink-2)]">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error || !food ? (
        <EmptyState title={error ?? t("common.error")} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* month summary */}
          <Card glass="regular" className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold tracking-[0.05em] text-[var(--color-ink-2)] uppercase">
                  {t("food.monthSpent")}
                </p>
                <p className="mt-1 text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">
                  {money(food.spent)}
                </p>
                <p className="mt-1.5 text-[14px] text-[var(--color-ink-2)] tabular-nums">
                  {money(food.budget - food.spent)} {t("food.left")} · {t("food.budget")} {money(food.budget)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {food.dailyBudget > 0 && (
                  <Chip tone="accent">{t("dash.foodDaily", { amount: money(food.dailyBudget) })}</Chip>
                )}
                <Chip tone="neutral">{t("dash.daysLeft", { n: Math.max(0, daysLeft(month, today)) })}</Chip>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar
                value={monthSpentPct}
                tone={monthSpentPct > 1 ? "red" : monthSpentPct > 0.9 ? "orange" : "green"}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-hair)] px-4 py-2.5">
              <span className="text-[14px] font-medium tabular-nums">
                {t("food.availableToday", { spent: money(food.todaySpent), available: money(food.availableToday) })}
              </span>
              {food.carry > 0 && <Chip tone="green">{t("food.carry", { amount: money(food.carry) })}</Chip>}
            </div>
          </Card>

          {/* daily rule + overspend (requirement 6: automatic, no manual posting) */}
          <Card glass="regular" className="p-5">
            <h2 className="text-[16px] font-semibold">{t("food.ruleTitle")}</h2>
            {food.budget === 0 ? (
              <p className="mt-1.5 text-[15px] text-[var(--color-ink-2)]">
                {t("food.noBudget")}{" "}
                <Link href="/settings" className="font-semibold text-[var(--color-accent)]">
                  {t("nav.settings")}
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-[15px] text-[var(--color-ink-2)]">
                  {t("dash.foodDaily", { amount: money(food.dailyBudget) })}
                  {food.availableToday > food.dailyBudget && (
                    <span className="text-[var(--color-green)]">
                      {" · "}
                      {t("food.carry", { amount: money(food.availableToday - food.dailyBudget) })}
                    </span>
                  )}
                </p>
                {food.overspend > 0 && food.targetCategoryName ? (
                  <p className="mt-2 text-[15px] font-semibold text-[var(--color-orange)]">
                    {t("food.overspendLine", { amount: money(food.overspend), category: food.targetCategoryName })}
                  </p>
                ) : (
                  <p className="mt-2 text-[15px] font-semibold text-[var(--color-green)]">{t("food.withinRule")}</p>
                )}
              </>
            )}
          </Card>

          {/* daily breakdown */}
          <section>
            <SectionTitle>{t("food.breakdown")}</SectionTitle>
            <Card className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {food.days.map((day) => {
                  const selected = selectedDay === day.date;
                  const hasSpend = day.spent > 0;
                  const status = day.over ? "over" : hasSpend ? "ok" : "none";
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDay(selected ? null : day.date)}
                      className={`press flex aspect-square flex-col items-center justify-center rounded-xl text-[13px] font-semibold transition ${
                        selected
                          ? "bg-[var(--color-accent)] text-white"
                          : status === "over"
                            ? "bg-[color-mix(in_srgb,var(--color-orange)_22%,transparent)] text-[#b26a00]"
                            : status === "ok"
                              ? "bg-[color-mix(in_srgb,var(--color-green)_16%,transparent)] text-[var(--color-green)]"
                              : "bg-[var(--color-hair)] text-[var(--color-ink-3)]"
                      }`}
                      aria-label={`${dayLabel(day.date)}: ${money(day.spent)}`}
                    >
                      <span className="tabular-nums">{Number(day.date.slice(8, 10))}</span>
                      <span className="text-[9px] leading-tight font-bold tabular-nums">
                        {hasSpend ? "●" : "\u00A0"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-ink-2)]">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-green)]" /> ok
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-orange)]" /> {t("food.over")}
                </span>
                {selectedDay && (
                  <button
                    type="button"
                    className="ml-auto font-semibold text-[var(--color-accent)]"
                    onClick={() => setSelectedDay(null)}
                  >
                    {t("common.close")}
                  </button>
                )}
              </div>
            </Card>
          </section>

          {/* entries */}
          <section>
            <SectionTitle>
              {selectedDay ? dayLabel(selectedDay, { weekday: true }) : monthLabel(month)}
            </SectionTitle>
            {visibleEntries.length === 0 ? (
              <EmptyState
                title={
                  selectedDay
                    ? t("food.empty", { month: dayLabel(selectedDay) })
                    : t("food.empty", { month: monthLabel(month) })
                }
              />
            ) : (
              <Card className="divide-y divide-[var(--color-hair)]">
                {visibleEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-medium">{entry.name}</p>
                      <p className="truncate text-[13px] text-[var(--color-ink-2)]">
                        {weekdayLabel(entry.spentOn)} · {entry.categoryName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[16px] font-semibold tabular-nums">{money(entry.amount)}</span>
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        onClick={() => void removeEntry(entry.id)}
                        className="press grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink-3)]"
                      >
                        <TrashIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>
      )}

      <MealSheet
        key={addOpen ? "open" : "closed"}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        food={food}
        defaultDate={selectedDay ?? today}
        onSaved={() => {
          setAddOpen(false);
          refetch();
        }}
      />
    </>
  );
}

function daysLeft(month: string, today: string): number {
  const [y, m] = month.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  if (today.slice(0, 7) < month) return total;
  if (today.slice(0, 7) > month) return 0;
  return Math.max(0, total - Number(today.slice(8, 10)));
}

function MealSheet({
  open,
  onClose,
  food,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  food: FoodPageData | undefined;
  defaultDate: string;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t("food.name"));
    if (!amount) return setError(t("food.amount"));
    setSaving(true);
    try {
      await api("/api/food", {
        method: "POST",
        body: {
          name: name.trim(),
          amount: Number(amount),
          spentOn: date,
          ...(categoryId !== "" ? { categoryId } : {}),
        },
      });
      setName("");
      setAmount("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("food.add")}>
      <div className="flex flex-col gap-4">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("food.namePlaceholder")}
          aria-label={t("food.name")}
        />
        <AmountKeypad value={amount} onChange={setAmount} max={10_000_000} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block px-1 text-[15px] font-medium text-[var(--color-ink-2)]">
              {t("food.date")}
            </span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block px-1 text-[15px] font-medium text-[var(--color-ink-2)]">
              {t("food.category")}
            </span>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">{t("setup.foodDefault")}</option>
              {(food?.categoryOptions ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-[14px] text-[var(--color-red)]">{error}</p>}
        <Button full loading={saving} onClick={() => void save()}>
          {t("food.save")}
        </Button>
      </div>
    </Sheet>
  );
}