/**
 * Phone number normalisation.
 * Accepts common Indonesian local formats and international numbers, returns E.164.
 *   '0812 3456 7890' -> '+6281234567890'
 *   '6281234567890'  -> '+6281234567890'
 *   '+62 812-3456-7890' -> '+6281234567890'
 *   '+1 555 010 2233' -> '+15550102233'
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  let digits: string;
  if (cleaned.startsWith("+")) {
    digits = cleaned.slice(1);
  } else if (cleaned.startsWith("0")) {
    digits = `62${cleaned.slice(1)}`; // Indonesian local: 0812... -> 62812...
  } else if (cleaned.startsWith("8")) {
    digits = `62${cleaned}`; // without leading zero: 812...
  } else if (cleaned.startsWith("62")) {
    digits = cleaned;
  } else {
    digits = cleaned;
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Format for display: +62 812-3456-7890 (keeps it readable without being pretty-printed too hard) */
export function formatPhone(phone: string): string {
  if (phone.startsWith("+62")) {
    const body = phone.slice(3);
    return `+62 ${body.replace(/^(\d{3})(\d{4})(\d+)$/, "$1-$2-$3")}`;
  }
  return phone;
}
