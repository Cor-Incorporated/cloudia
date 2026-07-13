import { ContactIntent } from '../types';
import { Locale } from '../translations';

/** corsweb ADR-0014 正本 7 キー */
export const CONTACT_INTENT_KEYS: readonly ContactIntent[] = [
  'confidential-ai-assessment',
  'local-llm-poc',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
  'contract-dev',
  'press-speaking-other',
] as const;

export const CONTACT_INTENT_LABELS: Record<ContactIntent, Record<Locale, string>> = {
  'confidential-ai-assessment': {
    ja: '機密データAI活用診断',
    en: 'Confidential data AI assessment',
  },
  'local-llm-poc': {
    ja: 'ローカルLLM / AI基盤PoC',
    en: 'Local LLM / AI infrastructure PoC',
  },
  'grift-team-beta': {
    ja: 'Grift Team Beta',
    en: 'Grift Team Beta',
  },
  'grift-paid-trial': {
    ja: 'Grift Paid Trial',
    en: 'Grift Paid Trial',
  },
  'estimate-audit': {
    ja: 'Estimate Audit',
    en: 'Estimate Audit',
  },
  'contract-dev': {
    ja: '受託開発の相談',
    en: 'Custom development inquiry',
  },
  'press-speaking-other': {
    ja: '取材・登壇・その他',
    en: 'Press, speaking, or other',
  },
};

/**
 * Visitor-facing purpose groups. The seven canonical intent keys remain the
 * routing contract; this catalog only controls how choices are presented.
 * The three Grift-related intents intentionally share one button. A new
 * selection uses estimate-audit as the representative key, while legacy URLs
 * keep their original key and still resolve to this same display group.
 */
export const CONTACT_INTENT_DISPLAY_OPTIONS = [
  {
    id: 'confidential-ai-assessment',
    primaryIntent: 'confidential-ai-assessment',
    intents: ['confidential-ai-assessment'],
    label: {
      ja: '機密データでAIを安全に使いたい',
      en: 'Use AI safely with confidential data',
    },
  },
  {
    id: 'local-llm-poc',
    primaryIntent: 'local-llm-poc',
    intents: ['local-llm-poc'],
    label: {
      ja: '社内向けAI基盤を試したい',
      en: 'Test a secure internal AI setup',
    },
  },
  {
    id: 'ai-estimate-system',
    primaryIntent: 'estimate-audit',
    intents: ['grift-team-beta', 'grift-paid-trial', 'estimate-audit'],
    label: {
      ja: 'AI見積もりシステムについて',
      en: 'About the AI estimate system',
    },
  },
  {
    id: 'contract-dev',
    primaryIntent: 'contract-dev',
    intents: ['contract-dev'],
    label: {
      ja: 'AI・システム開発を依頼したい',
      en: 'Request AI or software development',
    },
  },
  {
    id: 'press-speaking-other',
    primaryIntent: 'press-speaking-other',
    intents: ['press-speaking-other'],
    label: {
      ja: '取材・登壇・その他を相談したい',
      en: 'Discuss press, speaking, or another inquiry',
    },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  primaryIntent: ContactIntent;
  intents: readonly ContactIntent[];
  label: Record<Locale, string>;
}>;

export type ContactIntentDisplayOption = (typeof CONTACT_INTENT_DISPLAY_OPTIONS)[number];

/** 未知・空のキーは null（未選択）へフォールバック */
export function parseContactIntent(raw: string | null | undefined): ContactIntent | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return (CONTACT_INTENT_KEYS as readonly string[]).includes(key)
    ? (key as ContactIntent)
    : null;
}

export function getIntentLabel(intent: ContactIntent, locale: Locale): string {
  return CONTACT_INTENT_LABELS[intent][locale] ?? CONTACT_INTENT_LABELS[intent].en;
}

/** Resolve a canonical intent to the visitor-facing group label. */
export function getIntentDisplayLabel(intent: ContactIntent, locale: Locale): string {
  const option = CONTACT_INTENT_DISPLAY_OPTIONS.find((candidate) => candidate.intents.some((candidateIntent) => candidateIntent === intent));
  return option?.label[locale] ?? getIntentLabel(intent, locale);
}

/** 人間対応（メール） vs 将来 Grift ハンドオフ。Phase 1 ではどちらも従来フロー。 */
export function isContractDevHandoffIntent(intent: ContactIntent | null): boolean {
  return intent === 'contract-dev';
}
