/** Money helpers. Amounts are INTEGER rupiah everywhere (IDR has no minor unit). */

export type Locale = "en" | "id";

const GROUPING: Record<Locale, string> = { en: "en-US", id: "id-ID" };

/** Rp 1,900,000 (en) / Rp 1.900.000 (id) */
export function formatRupiah(amount: number, locale: Locale = "en"): string {
  const abs = Math.abs(Math.round(amount));
  const grouped = abs.toLocaleString(GROUPING[locale] ?? "en-US");
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp ${grouped}`;
}

/** Compact display for dense UIs: Rp 1,9jt / Rp 850rb (id) — falls back to full format in en */
export function formatRupiahCompact(amount: number, locale: Locale = "en"): string {
  const abs = Math.abs(Math.round(amount));
  const sign = amount < 0 ? "-" : "";
  if (locale === "id") {
    if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`;
    if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
    if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`;
  }
  return formatRupiah(amount, locale);
}

/** Parse a user-typed amount ('1.900.000', '40 000', '40000') into integer rupiah. Returns null when invalid. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  // If both separators appear, assume the last one is the decimal mark (IDR: no decimals expected).
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;
  if (lastDot >= 0 && lastComma >= 0) {
    const thousands = Math.min(lastDot, lastComma);
    normalized =
      cleaned.slice(0, thousands).replace(/[.,]/g, "") + cleaned.slice(thousands + 1).replace(/[.,]/g, "");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = cleaned.split(sep);
    // "1.5" style single fractional digit group -> treat as thousands only if groups of 3
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    normalized = isThousands ? parts.join("") : parts.join("");
  }
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/** Percentage in basis points -> human string, e.g. 5000 -> "50", 3350 -> "33.5" */
export function formatPercent(bp: number): string {
  const value = bp / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}
