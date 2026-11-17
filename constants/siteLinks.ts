import type { Locale } from '../translations';

/**
 * corsweb の site top の言語別 path（constants/privacy.ts の PRIVACY_POLICY_PATHS と同じ書き方）。
 * ja はルート直下、en は /en/ の下（corsweb の src/pages/index.astro と src/pages/en/index.astro）。
 */
export const SITE_TOP_PATHS: Readonly<Record<Locale, string>> = {
  en: '/en/',
  ja: '/',
};

/** corsweb の問い合わせ page の言語別 path。 */
export const CONTACT_PAGE_PATHS: Readonly<Record<Locale, string>> = {
  en: '/en/contact/',
  ja: '/contact/',
};

/**
 * 問い合わせ page のカレンダーの区画への link。corsweb の src/config/site.ts の
 * getContactCalendarUrl（CONTACT_CALENDAR_SOURCE = 'footer-calendar'、
 * CONTACT_CALENDAR_ANCHOR = 'contact-calendar'）と同じ形。
 * カレンダーの区画は /contact/ page の下に在る（Calendar.astro の section id）。
 */
export function contactCalendarHref(locale: Locale): string {
  return `${CONTACT_PAGE_PATHS[locale]}?source=footer-calendar#contact-calendar`;
}
