import type { Locale } from '../translations';

/**
 * corsweb のプライバシーポリシーの頁。Cloudia は cor-jp.com と同じ origin（/contact/chat/）で開くので、
 * path だけで足りる。言語ごとの頁は corsweb の src/pages/privacy.astro と src/pages/en/privacy.astro。
 */
export const PRIVACY_POLICY_PATHS: Readonly<Record<Locale, string>> = {
  en: '/en/privacy/',
  ja: '/privacy/',
};

/**
 * AI 受付の節の id（corsweb の privacy.astro の第 9 項）。頁にこの id がまだ無くても、
 * リンクは頁の頭に着くだけで壊れない。
 */
export const PRIVACY_AI_RECEPTION_ANCHOR = 'ai-reception';

export function privacyPolicyHref(locale: Locale): string {
  return `${PRIVACY_POLICY_PATHS[locale]}#${PRIVACY_AI_RECEPTION_ANCHOR}`;
}
