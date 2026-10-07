"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { localToday, refreshApi, useApi } from "@/lib/client";
import { useI18n } from "./i18n-provider";
import { ForkIcon, GearIcon, HomeIcon, ListIcon, PieIcon, PlusIcon } from "./icons";
import { AddExpenseSheet } from "./add-expense-sheet";

const TABS = [
  { href: "/dashboard", labelKey: "nav.dashboard", Icon: HomeIcon },
  { href: "/expenses", labelKey: "nav.expenses", Icon: ListIcon },
  { href: "/food", labelKey: "nav.food", Icon: ForkIcon },
  { href: "/budget", labelKey: "nav.budget", Icon: PieIcon },
  { href: "/settings", labelKey: "nav.settings", Icon: GearIcon },
] as const;

/** Floating glass tab bar — works the same on phone and desktop (iOS-first). */
export function TabBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const budget = useApi<{
    backbone: { categories: Array<{ id: number; name: string; defaultForFood: boolean }> };
  }>("/api/budget");
  const defaultFoodCategoryId =
    budget.data?.backbone.categories.find((c) => c.defaultForFood)?.id ?? "";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-3 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]">
        <div className="flex w-full max-w-2xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="material material-regular press grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full text-[var(--color-ink-2)]"
            aria-label={t("exp.add")}
          >
            <PlusIcon size={24} />
          </button>
          <div className="material material-regular flex flex-1 items-stretch justify-between rounded-full px-1.5 py-1.5">
            {TABS.map(({ href, labelKey, Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 ${
                    active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-2)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={23} strokeWidth={active ? 2 : 1.75} />
                  <span className={`truncate text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{t(labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <AddExpenseSheet
        key={addOpen ? "open" : "closed"}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={
          budget.data?.backbone.categories.map((c) => ({ id: c.id, name: c.name })) ?? []
        }
        defaultDate={localToday()}
        defaultCategoryId={defaultFoodCategoryId}
        defaultIsFood={true}
        onSaved={() => {
          setAddOpen(false);
          refreshApi();
        }}
      />
    </>
  );
}
