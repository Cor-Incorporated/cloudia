/**
 * Provisional industry copy for the contact chat.
 *
 * The owner's final wording (from a separate drafting session) has not
 * arrived. These sentences are a stand-in so the five industry pages can open
 * a relevant conversation. They are not a diagnosis, a legal or tax
 * conclusion, a certification, or a promised result.
 *
 * The query string is not copied in. Callers pass a value that has already
 * been checked against the industry enum, and these functions check again.
 */
import type { Locale } from '../translations';
import { contactCopyLocale } from '../utils/contactLocale';
import {
  isIndustryEntrySource,
  parseEntrySourceValue,
  type IndustryEntrySource,
} from './entrySources';

export interface IndustryGuidance {
  source: IndustryEntrySource;
  /** Marks this wording as a stand-in for the unreleased final copy. */
  provisional: true;
  label: Record<Locale, string>;
  opening: Record<Locale, string>;
  question: Record<Locale, string>;
}

const GUIDANCE: Record<IndustryEntrySource, IndustryGuidance> = {
  'industry-medical': {
    source: 'industry-medical',
    provisional: true,
    label: { ja: '医療', en: 'Healthcare' },
    opening: {
      ja: '医療のページから開いています。患者さんの記録、症状、個人名は書かないでください。ここでは診断も、結果の保証もしません。',
      en: 'You opened this from the healthcare page. Do not write patient records, symptoms, or anyone\'s name. This chat does not make a diagnosis or promise a result.',
    },
    question: {
      ja: '受付、記録の下書き、院内の調べもののどれに近いご相談ですか。',
      en: 'Is this closer to reception, drafting notes, or an internal lookup?',
    },
  },
  'industry-shigyo': {
    source: 'industry-shigyo',
    provisional: true,
    label: { ja: '士業', en: 'Professional services' },
    opening: {
      ja: '士業のページから開いています。依頼者名や案件の中身は書かないでください。法律や税務の結論は出しません。',
      en: 'You opened this from the professional-services page. Do not write a client\'s name or the contents of a matter. This chat does not give a legal or tax conclusion.',
    },
    question: {
      ja: 'どの事務所の、どの業務についてのご相談ですか。',
      en: 'Which kind of office, and which kind of work, is this about?',
    },
  },
  'industry-construction': {
    source: 'industry-construction',
    provisional: true,
    label: { ja: '建設', en: 'Construction' },
    opening: {
      ja: '建設のページから開いています。施主名や契約書は書かないでください。工期や安全の適合は、ここでは断定しません。',
      en: 'You opened this from the construction page. Do not write a client\'s name or paste a contract. This chat does not confirm a schedule or a safety approval.',
    },
    question: {
      ja: '現場の記録、見積りの整理、社内の調べもののどれに近いご相談ですか。',
      en: 'Is this closer to site notes, organizing an estimate, or an internal lookup?',
    },
  },
  'industry-manufacturing': {
    source: 'industry-manufacturing',
    provisional: true,
    label: { ja: '製造', en: 'Manufacturing' },
    opening: {
      ja: '製造のページから開いています。図面、顧客の仕様、個人名は書かないでください。品質や歩留まりの改善は、ここでは断定しません。',
      en: 'You opened this from the manufacturing page. Do not paste drawings, a customer\'s specifications, or personal names. This chat does not promise a quality or yield result.',
    },
    question: {
      ja: '現場のメモ、品質の記録、社内の調べもののどれに近いご相談ですか。',
      en: 'Is this closer to shop-floor notes, quality records, or an internal lookup?',
    },
  },
  'industry-education': {
    source: 'industry-education',
    provisional: true,
    label: { ja: '教育', en: 'Education' },
    opening: {
      ja: '教育のページから開いています。生徒の名前や成績は書かないでください。学習効果は、ここでは断定しません。',
      en: 'You opened this from the education page. Do not write a student\'s name or grades. This chat does not promise a learning outcome.',
    },
    question: {
      ja: '職員の事務、教材の下書き、問い合わせ対応のどれに近いご相談ですか。',
      en: 'Is this closer to staff administration, drafting teaching material, or handling inquiries?',
    },
  },
};

export function industryGuidance(source: IndustryEntrySource): IndustryGuidance {
  switch (source) {
    case 'industry-medical':
    case 'industry-shigyo':
    case 'industry-construction':
    case 'industry-manufacturing':
    case 'industry-education':
      return GUIDANCE[source];
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

/** The safety sentence only. Null unless `raw` is an industry enum. */
export function industryOpening(raw: unknown, locale: Locale | string): string | null {
  const entry = parseEntrySourceValue(raw);
  if (!isIndustryEntrySource(entry)) return null;
  return industryGuidance(entry).opening[contactCopyLocale(locale)];
}

/**
 * First sentence of the opening. corsweb's start reply (PR 510 head
 * 291af3fa, contract docs/industry-chat-worker-contract-2026-11-08.md)
 * reuses this sentence and then asks one intent-specific question, sometimes
 * without a newline. Matching the whole Cloudia line would miss that reply.
 */
export function industryReceptionMarker(raw: unknown, locale: Locale | string): string | null {
  const opening = industryOpening(raw, locale);
  if (!opening) return null;
  const stop = contactCopyLocale(locale) === 'ja' ? '。' : '.';
  const end = opening.indexOf(stop);
  return end < 0 ? opening : opening.slice(0, end + stop.length);
}

/** Visitor-facing opening plus the one fallback question. Null unless `raw` is an industry enum. */
export function industryContextLine(raw: unknown, locale: Locale | string): string | null {
  const entry = parseEntrySourceValue(raw);
  if (!isIndustryEntrySource(entry)) return null;
  const guidance = industryGuidance(entry);
  const copyLocale = contactCopyLocale(locale);
  return `${guidance.opening[copyLocale]}\n${guidance.question[copyLocale]}`;
}

export function industryLabel(raw: unknown, locale: Locale | string): string | null {
  const entry = parseEntrySourceValue(raw);
  if (!isIndustryEntrySource(entry)) return null;
  return industryGuidance(entry).label[contactCopyLocale(locale)];
}

const MAX_CHAT_MESSAGES = 20;

export interface IndustryContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface IndustryThreadMessage {
  role?: 'user' | 'assistant';
  content?: string;
  sender?: 'user' | 'ai';
  text?: string;
}

function messageRole(message: IndustryThreadMessage): 'user' | 'assistant' | null {
  if (message.role === 'user' || message.role === 'assistant') return message.role;
  if (message.sender === 'ai') return 'assistant';
  if (message.sender === 'user') return 'user';
  return null;
}

function messageText(message: IndustryThreadMessage): string {
  return message.content ?? message.text ?? '';
}

/** True when an assistant turn already carries the industry reception. User text does not count. */
export function historyHasIndustryReception(
  messages: readonly IndustryThreadMessage[],
  rawSource: unknown,
  locale: Locale | string,
): boolean {
  const marker = industryReceptionMarker(rawSource, locale);
  if (!marker) return false;
  return messages.some((message) => messageRole(message) === 'assistant' && messageText(message).includes(marker));
}

/**
 * What the industry panel may add beside the thread.
 * - heading: the short label. The first reply already contains the reception.
 * - boundary: the safety sentence, before a first reply exists.
 * - question: the one fallback question, when the first reply is missing or generic.
 * - none: this entry is not an industry.
 */
export function industryNotice(input: {
  rawSource: unknown;
  locale: Locale | string;
  messages: readonly IndustryThreadMessage[];
  startSettled: boolean;
}): 'none' | 'heading' | 'boundary' | 'question' {
  if (!industryContextLine(input.rawSource, input.locale)) return 'none';
  if (historyHasIndustryReception(input.messages, input.rawSource, input.locale)) return 'heading';
  return input.startSettled ? 'question' : 'boundary';
}

/**
 * Adds the fixed industry line to a later chat turn only while the thread
 * has no industry reception yet. A reply that already contains the marker
 * stays as it is: this does not delete it and does not add a second question.
 * The line is the enum's copy, never the raw query.
 */
export function withIndustryContext<T extends IndustryContextMessage>(
  messages: readonly T[],
  rawSource: unknown,
  locale: Locale | string,
): T[] {
  if (historyHasIndustryReception(messages, rawSource, locale)) {
    return [...messages].slice(-MAX_CHAT_MESSAGES);
  }
  const line = industryContextLine(rawSource, locale);
  if (!line) return [...messages].slice(-MAX_CHAT_MESSAGES);
  const context = { role: 'assistant' as const, content: line };
  const rest = messages.filter((message) => message.content !== line);
  const room = MAX_CHAT_MESSAGES - 1;
  const kept = rest.slice(-room);
  if (kept.length > 0 && kept[0].role === 'assistant') {
    return [kept[0], context as T, ...kept.slice(1)];
  }
  return [context as T, ...kept];
}

/** One enum line on the inquiry summary. A value that is not an entry source adds nothing. */
export function summaryWithEntrySource(summary: string, rawSource: unknown): string {
  const entry = parseEntrySourceValue(rawSource);
  if (!entry) return summary;
  const line = `entry_source:${entry}`;
  if (summary.split('\n').includes(line)) return summary;
  const next = summary.trim() ? `${summary.trim()}\n${line}` : line;
  return next.slice(0, 8000);
}

/**
 * Local-intake policy for the model. Fixed text for the enum. It tells the
 * model what not to ask for. It is not shown to the visitor.
 */
export function industryModelPolicy(source: IndustryEntrySource): string {
  const guidance = industryGuidance(source);
  switch (source) {
    case 'industry-medical':
      return [
        `Industry context (trusted enum ${source}, provisional copy): ${guidance.label.en}.`,
        'Ask only which kind of work this is (reception, drafting notes, or an internal lookup).',
        'Do not request patient records, symptoms, diagnoses, or personal names.',
        'Do not make a diagnosis, claim a certification, or promise an outcome.',
      ].join(' ');
    case 'industry-shigyo':
      return [
        `Industry context (trusted enum ${source}, provisional copy): ${guidance.label.en}.`,
        'Ask only the kind of office and the kind of work.',
        'Do not request a client name or the contents of a matter.',
        'Do not give a legal or tax conclusion or promise an outcome.',
      ].join(' ');
    case 'industry-construction':
      return [
        `Industry context (trusted enum ${source}, provisional copy): ${guidance.label.en}.`,
        'Ask only whether this is closer to site notes, organizing an estimate, or an internal lookup.',
        'Do not request a client name or a contract.',
        'Do not confirm a schedule, a safety approval, or promise an outcome.',
      ].join(' ');
    case 'industry-manufacturing':
      return [
        `Industry context (trusted enum ${source}, provisional copy): ${guidance.label.en}.`,
        'Ask only whether this is closer to shop-floor notes, quality records, or an internal lookup.',
        'Do not request drawings, a customer specification, or personal names.',
        'Do not promise a quality or yield result.',
      ].join(' ');
    case 'industry-education':
      return [
        `Industry context (trusted enum ${source}, provisional copy): ${guidance.label.en}.`,
        'Ask only whether this is closer to staff administration, drafting teaching material, or handling inquiries.',
        'Do not request a student name or grades.',
        'Do not promise a learning outcome.',
      ].join(' ');
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}
