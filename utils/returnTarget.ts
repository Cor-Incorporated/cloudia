import type { Locale } from '../translations';
import { translations } from '../translations';
import { parseEntrySourceFromSearch, type EntrySource } from '../constants/entrySources';
import { CONTACT_PAGE_PATHS, SITE_TOP_PATHS } from '../constants/siteLinks';

/**
 * 戻る先として許す host（https のみ）。この一覧に無い host は、来た元としても
 * 戻る先にしない（外の誰かが作った link で、知らない場所へ飛ばさないため）。
 */
const ALLOWED_RETURN_HOSTS = ['cor-jp.com', 'www.cor-jp.com', 'griftai.org', 'www.griftai.org'] as const;
const GRIFT_RETURN_HOSTS = ['griftai.org', 'www.griftai.org'] as const;
const COR_RETURN_HOSTS = ['cor-jp.com', 'www.cor-jp.com'] as const;

/** chat 自身の path。referrer がこれで始まるときは、自分に戻る輪になるので使わない。 */
const CHAT_PATH_PREFIX = '/contact/chat';

/** 業種の入口の source → corsweb の業種 page の slug（src/pages/industries/*.astro、[lang]/industries/[industry].astro）。 */
const INDUSTRY_PAGE_SLUGS: Readonly<Record<string, string>> = {
  'industry-medical': 'medical',
  'industry-shigyo': 'shigyo',
  'industry-construction': 'construction',
  'industry-manufacturing': 'manufacturing',
  'industry-education': 'education',
};

/** 戻る先の link の文の種類。Grift のサイト／サイトの top／サイトの中の page。 */
export type ReturnLabelKind = 'grift' | 'cor-site' | 'page';

export const RETURN_LINK_LABEL_KEYS: Readonly<Record<ReturnLabelKind, keyof typeof translations.en>> = {
  grift: 'backToGriftSite',
  'cor-site': 'backToCorSite',
  page: 'backToPreviousPage',
};

/**
 * 戻る先の href から、link の文の種類を決める。
 * Grift の host → Grift の文。site top（ja /・en /en/）→ Cor. のサイトの文。それ以外 → page の文。
 */
export function classifyReturnTarget(href: string): ReturnLabelKind {
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if ((GRIFT_RETURN_HOSTS as readonly string[]).includes(url.host)) return 'grift';
      if (
        (COR_RETURN_HOSTS as readonly string[]).includes(url.host) &&
        (url.pathname === '/' || url.pathname === '/en' || url.pathname === '/en/')
      ) {
        return 'cor-site';
      }
      return 'page';
    } catch {
      // fall through to the relative-path handling below.
    }
  }
  if (href === '/' || href === '/en' || href === '/en/') return 'cor-site';
  return 'page';
}

/**
 * 許した host の https referrer だけを戻る先の候補にする。
 * chat 自身（/contact/chat で始まる path）は、自分に戻る輪になるので使わない。
 */
function allowedReferrerHref(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!(ALLOWED_RETURN_HOSTS as readonly string[]).includes(url.host)) return null;
  if (url.pathname.startsWith(CHAT_PATH_PREFIX)) return null;
  return url.href;
}

/**
 * 今の URL の ?source= から戻る先の page（言語の接頭つき）を決める。
 * 業種の source → その業種の page。corsweb-contact-primary → 問い合わせ page。
 * 決まった元の page の無い source（浮きボタンなど）は null。
 */
export function entrySourceReturnHref(currentUrl: string, locale: Locale): string | null {
  let search: string;
  try {
    search = new URL(currentUrl).search;
  } catch {
    return null;
  }
  const source: EntrySource | null = parseEntrySourceFromSearch(search);
  if (!source) return null;
  const slug = INDUSTRY_PAGE_SLUGS[source];
  if (slug) return locale === 'en' ? `/en/industries/${slug}/` : `/industries/${slug}/`;
  if (source === 'corsweb-contact-primary') return CONTACT_PAGE_PATHS[locale];
  return null;
}

/**
 * 戻る先を 1 本に決める。引数は referrer・今の URL・言語で、画面の外（試験）からも渡せる。
 * (i) 許した host の referrer（chat 自身は除く）→ (ii) ?source= の page → (iii) サイトの top。
 */
export function resolveReturnTarget(referrer: string | null | undefined, currentUrl: string, locale: Locale): string {
  const referrerHref = allowedReferrerHref(referrer);
  if (referrerHref) return referrerHref;
  const fromSource = entrySourceReturnHref(currentUrl, locale);
  if (fromSource) return fromSource;
  return SITE_TOP_PATHS[locale];
}

export const RETURN_TARGET_STORAGE_KEY = 'cloudia:return-target';

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 前に決めた戻る先を読む。無い・壊れている・storage が使えないときは null。 */
export function readStoredReturnTarget(storage: MinimalStorage | null): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(RETURN_TARGET_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** 戻る先を残す。storage が使えない環境では何もしない（chat は止めない）。 */
export function saveReturnTarget(href: string, storage: MinimalStorage | null): void {
  if (!storage || !href.trim()) return;
  try {
    storage.setItem(RETURN_TARGET_STORAGE_KEY, href.trim());
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
