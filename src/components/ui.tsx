"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/* --------------------------------- surfaces --------------------------------- */

export function Card({
  children,
  className = "",
  glass,
}: {
  children?: ReactNode;
  className?: string;
  glass?: "thin" | "regular" | "thick";
}) {
  if (glass) {
    return (
      <div className={`material material-${glass} rounded-[20px] ${className}`}>{children}</div>
    );
  }
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between px-1">
      <h2 className="text-[13px] font-semibold tracking-[0.06em] text-[var(--color-ink-2)] uppercase">{children}</h2>
      {action}
    </div>
  );
}

/* --------------------------------- buttons ---------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  loading?: boolean;
  full?: boolean;
};

export function Button({ variant = "primary", loading, full, className = "", children, disabled, ...rest }: ButtonProps) {
  const base =
    "press inline-flex items-center justify-center gap-2 rounded-full px-6 min-h-[50px] text-[17px] font-semibold transition disabled:opacity-45 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-[var(--color-accent)] text-white shadow-[0_6px_20px_rgba(0,122,255,0.28)]",
    secondary: "bg-[var(--color-card)] text-[var(--color-accent)] hairline",
    quiet: "bg-transparent text-[var(--color-accent)]",
    danger: "bg-[var(--color-red)] text-white",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={`press grid h-11 w-11 place-items-center rounded-full text-[var(--color-ink-2)] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/* --------------------------------- fields ----------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[15px] font-medium text-[var(--color-ink-2)]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block px-1 text-[13px] text-[var(--color-ink-3)]">{hint}</span>}
      {error && <span className="mt-1 block px-1 text-[13px] text-[var(--color-red)]">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

/** Settings-style row: label on the left, control on the right. */
export function Row({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-[52px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 ${className}`}>
      <span className="text-[16px] text-[var(--color-ink)]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* --------------------------------- misc ------------------------------------- */

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "green" | "orange" | "red" }) {
  const pct = Math.max(0, Math.min(1, value));
  const colors: Record<string, string> = {
    accent: "var(--color-accent)",
    green: "var(--color-green)",
    orange: "var(--color-orange)",
    red: "var(--color-red)",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-hair)]">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-ios)]"
        style={{ width: `${pct * 100}%`, background: colors[tone] }}
      />
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "green" | "orange" | "red" }) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--color-hair)] text-[var(--color-ink-2)]",
    accent: "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]",
    green: "bg-[color-mix(in_srgb,var(--color-green)_16%,transparent)] text-[var(--color-green)]",
    orange: "bg-[color-mix(in_srgb,var(--color-orange)_18%,transparent)] text-[var(--color-orange-ink)]",
    red: "bg-[color-mix(in_srgb,var(--color-red)_14%,transparent)] text-[var(--color-red)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** iOS segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-[10px] bg-[var(--color-hair)] p-[2px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-[8px] px-3 py-1.5 text-[14px] font-semibold transition ${
            value === option.value
              ? "bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "text-[var(--color-ink-2)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="text-[16px] font-medium text-[var(--color-ink)]">{title}</p>
      {hint && <p className="mt-1 text-[14px] text-[var(--color-ink-2)]">{hint}</p>}
    </div>
  );
}
