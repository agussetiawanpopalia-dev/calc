"use client";

import type { ReactNode } from "react";

/** Sticky translucent bar with a large-ish title — content scrolls beneath it. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="material material-regular sticky top-3 z-30 mb-6 flex items-center justify-between gap-4 rounded-[24px] px-6 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] leading-[1.2] font-bold tracking-[-0.01em]">{title}</h1>
        <p className="mt-0.5 truncate text-[14px] text-[var(--color-ink-2)]">{subtitle ?? "\u00A0"}</p>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
