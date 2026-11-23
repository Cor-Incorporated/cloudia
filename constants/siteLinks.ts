import type { Locale } from '../translations';

type SiteLocale = Locale | 'zh' | 'ko' | 'es';

/** Preserve the originating site language when its conversation uses English. */
export function siteLocale(uiLocale: Locale, search: string): SiteLocale {
  const values = new URLSearchParams(search).getAll('locale');
  const requested = values.length === 1 ? values[0] : null;
  if (uiLocale === 'en' && (requested === 'zh' || requested === 'ko' || requested === 'es')) return requested;
  return uiLocale;
}

export function sitePrefix(locale: SiteLocale): string {
  return locale === 'ja' ? '' : '/' + locale;
}

export function contactCalendarHref(locale: Locale, search: string): string {
  return sitePrefix(siteLocale(locale, search)) + '/contact/?source=footer-calendar#contact-calendar';
}

export function materialRequestHref(locale: Locale, search: string): string {
  return 'https://cor-jp.com' + sitePrefix(siteLocale(locale, search)) + '/contact/materials/';
}
