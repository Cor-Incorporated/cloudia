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

/**
 * Copy status shared with corsweb's contact Worker. The reception contract
 * fixture holds the same value, so a change on one side fails a test.
 */
export const INDUSTRY_COPY_STATUS = 'aligned-2026-11-13' as const;

export interface IndustryGuidance {
  source: IndustryEntrySource;
  /** The wording follows the published industry pages (see INDUSTRY_COPY_STATUS). */
  copyStatus: typeof INDUSTRY_COPY_STATUS;
  label: Record<Locale, string>;
  opening: Record<Locale, string>;
  question: Record<Locale, string>;
}

const GUIDANCE: Record<IndustryEntrySource, IndustryGuidance> = {
  'industry-medical': {
    source: 'industry-medical',
    copyStatus: INDUSTRY_COPY_STATUS,
    label: { ja: '医療', en: 'Healthcare' },
    opening: {
      ja: '医療のページから開いています。最初は業務の概要だけで構いません。患者さんの実データやカルテ、認証情報は書かないでください。ここでは診断も、結果の保証もしません。',
      en: 'You opened this from the healthcare page. An outline of the work is enough to start. Do not write real patient data, medical records, or login credentials. This chat does not make a diagnosis or promise a result.',
    },
    question: {
      ja: '紹介状の下書きや看護サマリーの整理など、まず、どんなことをしたいとお考えですか。',
      en: 'To start, what would you like to do, for example drafting referral letters or organizing nursing summaries?',
    },
  },
  'industry-shigyo': {
    source: 'industry-shigyo',
    copyStatus: INDUSTRY_COPY_STATUS,
    label: { ja: '士業', en: 'Professional services' },
    opening: {
      ja: '士業のページから開いています。最初は業務の概要だけで構いません。顧問先・依頼者の実データや認証情報は書かないでください。法律や税務の結論は出しません。',
      en: 'You opened this from the professional-services page. An outline of the work is enough to start. Do not write real data about your clients or login credentials. This chat does not give a legal or tax conclusion.',
    },
    question: {
      ja: '顧問先への回答案づくりや案件資料の整理など、まず、どんなことをしたいとお考えですか。',
      en: 'To start, what would you like to do, for example drafting answers for client companies or organizing case documents?',
    },
  },
  'industry-construction': {
    source: 'industry-construction',
    copyStatus: INDUSTRY_COPY_STATUS,
    label: { ja: '建設', en: 'Construction' },
    opening: {
      ja: '建設のページから開いています。最初は業務の概要だけで構いません。現場の実データや機密資料は書かないでください。工期や安全の適合は、ここでは断定しません。',
      en: 'You opened this from the construction page. An outline of the work is enough to start. Do not write real site data or confidential documents. This chat does not confirm a schedule or a safety approval.',
    },
    question: {
      ja: '現場から届く報告の転記や書類の下書きなど、まず、どんなことをしたいとお考えですか。',
      en: 'To start, what would you like to do, for example transcribing reports from the site or drafting documents?',
    },
  },
  'industry-manufacturing': {
    source: 'industry-manufacturing',
    copyStatus: INDUSTRY_COPY_STATUS,
    label: { ja: '製造', en: 'Manufacturing' },
    opening: {
      ja: '製造のページから開いています。最初は業務の概要だけで構いません。現場の実データや機密資料は書かないでください。品質や歩留まりの改善は、ここでは断定しません。',
      en: 'You opened this from the manufacturing page. An outline of the work is enough to start. Do not write real shop-floor data or confidential documents. This chat does not promise a quality or yield result.',
    },
    question: {
      ja: '日報や、次の担当者へ残したい作業の手がかりなど、まず、どんなことをしたいとお考えですか。',
      en: 'To start, what would you like to do, for example daily reports or the clues you want to leave for the next person on a task?',
    },
  },
  'industry-education': {
    source: 'industry-education',
    copyStatus: INDUSTRY_COPY_STATUS,
    label: { ja: '教育', en: 'Education' },
    opening: {
      ja: '教育のページから開いています。最初は業務の概要だけで構いません。学生・生徒の実データ、機密資料、認証情報は書かないでください。学習効果は、ここでは断定しません。',
      en: 'You opened this from the education page. An outline of the work is enough to start. Do not write real student data, confidential documents, or login credentials. This chat does not promise a learning outcome.',
    },
    question: {
      ja: '学内の資料の検索や教務システムへの転記など、まず、どんなことをしたいとお考えですか。',
      en: 'To start, what would you like to do, for example searching school documents or transcribing into the academic system?',
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
        `Industry context (trusted enum ${source}, copy ${INDUSTRY_COPY_STATUS}): ${guidance.label.en}.`,
        'Ask only what the visitor wants to do first (for example referral letters or nursing summaries).',
        'Do not request patient records, symptoms, diagnoses, or personal names.',
        'Do not make a diagnosis, claim a certification, or promise an outcome.',
      ].join(' ');
    case 'industry-shigyo':
      return [
        `Industry context (trusted enum ${source}, copy ${INDUSTRY_COPY_STATUS}): ${guidance.label.en}.`,
        'Ask only what the visitor wants to do first (for example answers for client companies or case documents).',
        'Do not request a client name or the contents of a matter.',
        'Do not give a legal or tax conclusion or promise an outcome.',
      ].join(' ');
    case 'industry-construction':
      return [
        `Industry context (trusted enum ${source}, copy ${INDUSTRY_COPY_STATUS}): ${guidance.label.en}.`,
        'Ask only what the visitor wants to do first (for example transcribing site reports or drafting documents).',
        'Do not request a client name or a contract.',
        'Do not confirm a schedule, a safety approval, or promise an outcome.',
      ].join(' ');
    case 'industry-manufacturing':
      return [
        `Industry context (trusted enum ${source}, copy ${INDUSTRY_COPY_STATUS}): ${guidance.label.en}.`,
        'Ask only what the visitor wants to do first (for example daily reports or clues for the next person on a task).',
        'Do not request drawings, a customer specification, or personal names.',
        'Do not promise a quality or yield result.',
      ].join(' ');
    case 'industry-education':
      return [
        `Industry context (trusted enum ${source}, copy ${INDUSTRY_COPY_STATUS}): ${guidance.label.en}.`,
        'Ask only what the visitor wants to do first (for example searching school documents or transcribing into the academic system).',
        'Do not request a student name or grades.',
        'Do not promise a learning outcome.',
      ].join(' ');
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}
