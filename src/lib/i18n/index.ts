import { en, type TranslationKey, type Dictionary } from "./en";
import { id } from "./id";

export type Locale = "en" | "id";
export type { TranslationKey, Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { en, id };

export function createTranslator(locale: Locale): (key: TranslationKey, params?: Record<string, string | number>) => string {
  const dict = dictionaries[locale] ?? en;
  return (key, params) => {
    let text: string = dict[key] ?? en[key] ?? String(key);
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  };
}

export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", id: "id-ID" };
