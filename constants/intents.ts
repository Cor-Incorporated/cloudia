import { ContactIntent } from '../types';
import { Locale } from '../translations';

export const CONTACT_INTENT_KEYS: readonly ContactIntent[] = [
  'confidential-ai-assessment',
  'local-llm-poc',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
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
  'press-speaking-other': {
    ja: '取材・登壇・その他',
    en: 'Press, speaking, or other',
  },
};

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
