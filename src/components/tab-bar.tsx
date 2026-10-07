"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "./i18n-provider";
import { ForkIcon, GearIcon, HomeIcon, ListIcon, PieIcon } from "./icons";

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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[env(safe-area-inset-bottom)]">
      <div className="material material-thick flex w-full max-w-md items-stretch justify-between rounded-full px-1.5 py-1.5">
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
              <span className={`truncate text-[10px] ${active ? "font-bold" : "font-medium"}`}>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
