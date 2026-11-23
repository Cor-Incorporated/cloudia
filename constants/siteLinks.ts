import type { Locale } from '../translations';
import type { SiteChromeLocale } from './siteChrome';

export function companyPageHref(target: string): string {
  return target.startsWith('/') ? 'https://cor-jp.com' + target : target;
}

/** Preserve the originating site language when its conversation uses English. */
export function siteLocale(uiLocale: Locale, search: string): SiteChromeLocale {
  const values = new URLSearchParams(search).getAll('locale');
  const requested = values.length === 1 ? values[0] : null;
  if (uiLocale === 'en' && (requested === 'zh' || requested === 'ko' || requested === 'es')) return requested;
  return uiLocale;
}

export function sitePrefix(locale: SiteChromeLocale): string {
  return locale === 'ja' ? '' : '/' + locale;
}

export function contactCalendarHref(locale: Locale, search: string): string {
  return companyPageHref(sitePrefix(siteLocale(locale, search)) + '/contact/?source=footer-calendar#contact-calendar');
}

export function materialRequestHref(locale: Locale, search: string): string {
  return companyPageHref(sitePrefix(siteLocale(locale, search)) + '/contact/materials/');
}
