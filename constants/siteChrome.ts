import data from './siteChrome.json';

export type SiteChromeLocale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
export type SiteChromeSiteId = 'cor' | 'grift' | 'cloudia';

export const SITE_CHROME_LOCALES: SiteChromeLocale[] = ['ja', 'en', 'zh', 'ko', 'es'];

export interface CommonLink {
  id: string;
  label: Record<SiteChromeLocale, string>;
  href: Record<SiteChromeLocale, string>;
}

export interface SiteLink {
  id: SiteChromeSiteId;
  label: string;
  href: string;
}

export interface SiteChrome {
  version: number;
  organization: Record<SiteChromeLocale, string>;
  commonLinks: CommonLink[];
  sites: SiteLink[];
}

/** 3 サイト共通の下の帯の中身。写す時はこの JSON をそのまま使う。 */
export const SITE_CHROME = data as SiteChrome;

/** 帯の年の表示に使う。定数で書かない（試験では時計を固定する）。 */
export function siteChromeYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** 今の lang の共通 link。並びは JSON のまま。 */
export function commonLinksFor(locale: SiteChromeLocale): Array<{ id: string; label: string; href: string }> {
  return SITE_CHROME.commonLinks.map((link) => ({
    id: link.id,
    label: link.label[locale],
    href: link.href[locale],
  }));
}
