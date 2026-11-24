import type { Locale } from '../translations';
import { companyPageHref, siteLocale, sitePrefix } from './siteLinks';

export const PRIVACY_AI_RECEPTION_ANCHOR = 'ai-reception';

export function privacyPolicyHref(locale: Locale, search = ''): string {
  return companyPageHref(sitePrefix(siteLocale(locale, search)) + '/privacy/#' + PRIVACY_AI_RECEPTION_ANCHOR);
}
