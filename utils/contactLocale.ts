import type { Locale } from '../translations';
import { isIndustryEntrySource, parseEntrySourceFromSearch } from '../constants/entrySources';

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

/** One explicit query value: ja/en stay, zh/ko/es become en, anything else is no request. */
export function queryUiLocale(raw: unknown): Locale | null {
  if (isContactLocale(raw)) return raw;
  return raw === 'zh' || raw === 'ko' || raw === 'es' ? 'en' : null;
}

/** The single explicit `locale` on a query. Missing, repeated, or unknown values are no request. */
export function queryEntryLocale(search: string): Locale | null {
  const [locale, duplicate] = new URLSearchParams(search).getAll('locale');
  if (duplicate !== undefined) return null;
  return queryUiLocale(locale);
}

/** Resolve the reception language requested by a supported industry page. */
export function industryEntryLocale(search: string): Locale | null {
  if (!isIndustryEntrySource(parseEntrySourceFromSearch(search))) return null;
  return queryEntryLocale(search);
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
  const query = queryUiLocale(input.query);
  if (query !== null) return query;
  if (isContactLocale(input.stored)) return input.stored;
  const browser = (input.browserLanguage ?? '').split('-')[0];
  if (isContactLocale(browser)) return browser;
  return 'en';
}
