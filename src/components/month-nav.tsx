"use client";

import { addMonths } from "@/lib/dates";
import { useI18n } from "./i18n-provider";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/** iOS-style compact month stepper for list pages. */
export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { monthLabel } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-[var(--color-hair)] p-0.5">
      <button
        type="button"
        aria-label="Previous month"
        className="press grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-2)]"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeftIcon size={17} />
      </button>
      <span className="min-w-[112px] text-center text-[14px] font-semibold tabular-nums">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        className="press grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-2)]"
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRightIcon size={17} />
      </button>
    </div>
  );
}
