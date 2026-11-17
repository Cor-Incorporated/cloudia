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
 * 許した host の https URL か（https・一覧の host）。
 */
function isAllowedReturnUrl(url: URL): boolean {
  return url.protocol === 'https:' && (ALLOWED_RETURN_HOSTS as readonly string[]).includes(url.host);
}

/** chat 自身の path か（/contact/chat で始まる）。自分に戻る輪になるので戻り先にしない。 */
function isChatPath(url: URL): boolean {
  return url.pathname.startsWith(CHAT_PATH_PREFIX);
}

function parseHttpUrl(href: string | null | undefined): URL | null {
  if (!href) return null;
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/** referrer が chat 自身からの遷移か（今の URL と同じ origin で、path が chat で始まる）。 */
function isSelfChatReferrer(referrerUrl: URL, currentUrl: string): boolean {
  const current = parseHttpUrl(currentUrl);
  return Boolean(current) && referrerUrl.origin === current!.origin && isChatPath(referrerUrl);
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
 * 戻る先の決定と、storage に残す値を 1 つにまとめた物。
 */
export interface ReturnTargetDecision {
  /** 戻る先として使う href。常に決まる。 */
  href: string;
  /** storage に残す値。残さない時は null。 */
  save: string | null;
}

/**
 * 戻る先を 1 本に決める。引数は referrer・今の URL・言語・残してある値で、
 * 画面の外（試験）からも渡せる。storage への書き込みはここでは行わない（App の effect で行う）。
 * 1. 許した host（https・一覧の host・chat 自身の path でない）の referrer → その URL を使い、
 *    前に残した値を上書きして残す。
 * 2. referrer が chat 自身（今の URL と同じ origin・path が /contact/chat で始まる）で、
 *    残してある値が有効 → 残してある値を使う（mode の切り替えの後も同じ先）。
 * 3. それ以外（referrer が無い・一覧に無い host）→ ?source= の page、無ければサイトの top。
 *    この値は残さない（言語を切り替えたら top は言語に合わせて変わる）。残してある値も使わない。
 */
export function resolveReturnTarget(
  referrer: string | null | undefined,
  currentUrl: string,
  locale: Locale,
  stored: string | null | undefined,
): ReturnTargetDecision {
  const referrerUrl = parseHttpUrl(referrer);
  if (referrerUrl && isAllowedReturnUrl(referrerUrl) && !isChatPath(referrerUrl)) {
    return { href: referrerUrl.href, save: referrerUrl.href };
  }
  if (referrerUrl && isSelfChatReferrer(referrerUrl, currentUrl)) {
    const validatedStored = validStoredReturnHref(stored);
    if (validatedStored) return { href: validatedStored, save: null };
  }
  const fromSource = entrySourceReturnHref(currentUrl, locale);
  return { href: fromSource ?? SITE_TOP_PATHS[locale], save: null };
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

/**
 * 残してある戻る先を読む時の検査（1 と同じ: https・一覧の host・chat 自身でない）。
 * 通らない値（相対 path・http・一覧に無い host・chat 自身）は無い物として扱う。
 */
export function validStoredReturnHref(stored: string | null | undefined): string | null {
  const url = parseHttpUrl(stored);
  if (!url || !isAllowedReturnUrl(url) || isChatPath(url)) return null;
  return url.href;
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

/**
 * 決まった戻り先を storage へ反映する。App の effect（描画の外）から呼ぶ。
 * save が決まっていない時（3 段目）は書かないので、前に残した値はそのまま残る。
 */
export function persistReturnTarget(decision: ReturnTargetDecision, storage: MinimalStorage | null): void {
  if (!decision.save) return;
  saveReturnTarget(decision.save, storage);
}
