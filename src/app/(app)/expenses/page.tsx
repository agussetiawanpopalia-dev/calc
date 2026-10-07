"use client";

import { useMemo, useState } from "react";
import { api, ApiError, localMonth, localToday, useApi } from "@/lib/client";
import type { Backbone, ExpenseItem, Preset } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { MonthNav } from "@/components/month-nav";
import { Card, Chip, EmptyState, Spinner } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { AddExpenseSheet } from "@/components/add-expense-sheet";

type ExpensesResponse = { month: string; total: number; expenses: ExpenseItem[] };
type BudgetResponse = { backbone: Backbone; presets: Preset[] };

export default function ExpensesPage() {
  const { t, money, monthLabel, dayLabel } = useI18n();
  const [month, setMonth] = useState(localMonth());
  const today = localToday();

  const list = useApi<ExpensesResponse>(`/api/expenses?month=${month}`);
  const budget = useApi<BudgetResponse>("/api/budget");
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const result: Array<{ date: string; items: ExpenseItem[] }> = [];
    for (const item of list.data?.expenses ?? []) {
      const last = result[result.length - 1];
      if (last && last.date === item.spentOn) last.items.push(item);
      else result.push({ date: item.spentOn, items: [item] });
    }
    return result;
  }, [list.data]);

  const remove = async (id: number) => {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setDeletingId(id);
    try {
      await api(`/api/expenses/${id}`, { method: "DELETE" });
      list.refetch();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  const categories = budget.data?.backbone.categories ?? [];

  return (
    <>
      <PageHeader title={t("exp.title")} right={<MonthNav month={month} onChange={setMonth} />} />

      <Card className="mb-4 flex items-center justify-between p-5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-ink-2)] uppercase">{monthLabel(month)}</p>
          <p className="text-[28px] leading-tight font-bold tabular-nums tracking-[-0.02em]">{money(list.data?.total ?? 0)}</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={categories.length === 0}
          className="press flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          <PlusIcon size={18} /> {t("exp.add")}
        </button>
      </Card>

      {list.loading && !list.data ? (
        <div className="flex justify-center py-16 text-[var(--color-ink-2)]">
          <Spinner className="h-6 w-6" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title={t("exp.empty", { month: monthLabel(month) })} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.date}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className="text-[13px] font-semibold tracking-[0.05em] text-[var(--color-ink-2)] uppercase">
                  {group.date === today ? t("exp.todayLabel") : dayLabel(group.date, { weekday: true })}
                </span>
                <span className="text-[13px] font-semibold text-[var(--color-ink-3)] tabular-nums">
                  {money(group.items.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
              <Card className="divide-y divide-[var(--color-hair)]">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-medium">{item.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--color-ink-2)]">
                        <span>{item.categoryName}</span>
                        {item.isFood && <Chip tone="green">{t("nav.food")}</Chip>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[17px] font-semibold tabular-nums tracking-tight">{money(item.amount)}</span>
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        disabled={deletingId === item.id}
                        onClick={() => void remove(item.id)}
                        className="press grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink-3)] disabled:opacity-40"
                      >
                        {deletingId === item.id ? <Spinner className="h-4 w-4" /> : <TrashIcon size={18} />}
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      <AddExpenseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories.map((c) => ({ id: c.id ?? 0, name: c.name }))}
        defaultDate={today}
        onSaved={() => {
          setAddOpen(false);
          list.refetch();
        }}
      />
    </>
  );
}
