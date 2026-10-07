"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createTranslator, INTL_LOCALE, type Locale, type TranslationKey } from "@/lib/i18n";
import { formatRupiah } from "@/lib/money";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  money: (amount: number) => string;
  /** '2026-10' -> 'October 2026' / 'Oktober 2026' */
  monthLabel: (month: string) => string;
  /** '2026-10-04' -> 'Oct 4' / '4 Okt' */
  dayLabel: (date: string, opts?: { weekday?: boolean }) => string;
  /** weekday name for '2026-10-04' */
  weekdayLabel: (date: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `mc_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = createTranslator(locale);
    const intl = INTL_LOCALE[locale];
    return {
      locale,
      setLocale,
      t,
      money: (amount: number) => formatRupiah(amount, locale),
      monthLabel: (month: string) => {
        const [y, m] = month.split("-").map(Number);
        if (!y || !m) return month;
        return new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
      },
      dayLabel: (date, opts) => {
        const [y, m, d] = date.split("-").map(Number);
        if (!y || !m || !d) return date;
        return new Intl.DateTimeFormat(intl, {
          month: "short",
          day: "numeric",
          ...(opts?.weekday ? { weekday: "short" } : {}),
        }).format(new Date(y, m - 1, d));
      },
      weekdayLabel: (date) => {
        const [y, m, d] = date.split("-").map(Number);
        if (!y || !m || !d) return "";
        return new Intl.DateTimeFormat(intl, { weekday: "short" }).format(new Date(y, m - 1, d));
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
