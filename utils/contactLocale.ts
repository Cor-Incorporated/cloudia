import type { Locale } from '../translations';

/** Cloudia contact UI languages. zh, ko, and es are not in this list. */
export const CONTACT_LOCALES = ['ja', 'en'] as const;

export function isContactLocale(value: unknown): value is Locale {
  return value === 'ja' || value === 'en';
}

/**
 * Copy language for industry text. ja stays ja. Every other value, including
 * zh, ko, and es, uses the English copy so a missing dictionary cannot render
 * the word "undefined".
 */
export function contactCopyLocale(raw: unknown): Locale {
  return raw === 'ja' ? 'ja' : 'en';
}

/**
 * The same order LanguageContext uses: exact query ja/en, then a stored ja/en,
 * then the browser language if it is exactly ja or en, otherwise English.
 * Query values such as zh, ko, es, and en-US are not languages of this UI.
 */
export function resolveUiLocale(input: {
  query: string | null;
  stored: string | null;
  browserLanguage: string | null;
}): Locale {
  if (isContactLocale(input.query)) return input.query;
  if (isContactLocale(input.stored)) return input.stored;
  const browser = (input.browserLanguage ?? '').split('-')[0];
  if (isContactLocale(browser)) return browser;
  return 'en';
}
