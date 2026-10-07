"use client";

import type { ReactNode } from "react";

/** Sticky translucent bar with a large-ish title — content scrolls beneath it. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="material-bar sticky top-0 z-30 -mx-4 mb-5 flex items-end justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top) + 16px)] pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[14px] text-[var(--color-ink-2)]">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
