"use client";

import { BackspaceIcon } from "./icons";
import { formatRupiah } from "@/lib/money";
import { useI18n } from "./i18n-provider";

/**
 * iOS-style numeric keypad for amount entry (calculator feel for a money app).
 * `value` is the raw digit string; empty string means 0.
 */
export function AmountKeypad({
  value,
  onChange,
  max = 10_000_000_000,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const { locale } = useI18n();
  const digits = value ? Number(value) : 0;

  const push = (digit: string) => {
    const next = `${value}${digit}`.replace(/^0+(?=\d)/, "");
    if (next.length > 12) return;
    if (Number(next) > max) return;
    onChange(next);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-full items-center justify-center">
        <span
          className={`truncate text-[40px] font-semibold tabular-nums tracking-[-0.02em] ${
            digits === 0 ? "text-[var(--color-ink-3)]" : "text-[var(--color-ink)]"
          }`}
        >
          {formatRupiah(digits, locale)}
        </span>
      </div>

      <div className="grid w-full grid-cols-3 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => push(key)}
            className="press h-14 rounded-2xl bg-[var(--color-hair)] text-[24px] font-medium tabular-nums tracking-tight active:bg-[color-mix(in_srgb,var(--color-hair)_60%,transparent)]"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          aria-label="Backspace"
          className="press grid h-14 place-items-center rounded-2xl bg-[var(--color-hair)] text-[var(--color-ink-2)]"
        >
          <BackspaceIcon size={24} />
        </button>
      </div>
    </div>
  );
}
