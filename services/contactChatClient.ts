/**
 * corsweb workers/contact-chat クライアント（ADR-0003）。
 * 本番: 同一オリジン相対パス。開発: VITE_CONTACT_API_BASE。
 */
import type { AppMode, ContactIntent } from '../types';
import type { Locale } from '../translations';
import { isGriftHandoffIntent, parseContactIntent } from '../constants/intents';
import { normalizeContactSource, normalizeLocale } from '../utils/launchContext';
import { parseAllowedGriftHandoffUrl, parseValidGriftHandoffExpiry } from '../utils/griftHandoff';

export type ChatRole = 'user' | 'assistant';

export interface ContactChatMessage {
  role: ChatRole;
  content: string;
}

export type Classification = 'genuine' | 'sales' | 'spam';

/** Non-PII fields collected by the Worker during structured intake. */
export interface StructuredLead {
  purpose?: string;
  industryRole?: string;
  dataSensitivity?: string;
  stage?: string;
  timingBudget?: string;
  /** Marketing context: how the visitor found Cor. */
  discoverySource?: string;
  /** Marketing context: why the visitor is contacting Cor. now. */
  contactReason?: string;
}

export interface ChatResult {
  reply: string;
  classification: Classification;
  readyForContact: boolean;
  sessionId?: string;
  stage?: string;
  summary?: string;
  faqResolution?: 'answered' | 'unresolved' | null;
  missingFields?: string[];
  structuredLead?: StructuredLead;
}

export interface ContactChatContext {
  mode: AppMode;
  locale: Locale;
  intent: ContactIntent | null;
  sessionId?: string | null;
  source?: string;
}

export type ContactChatStartContext = ContactChatContext;

export interface ContactChatRequestOptions {
  signal?: AbortSignal;
}

export class ContactChatUnavailableError extends Error {
  constructor() {
    super('Contact chat is unavailable');
    this.name = 'ContactChatUnavailableError';
  }
}

function normalizeChatContext(context: ContactChatContext): Required<ContactChatContext> {
  return {
    mode: context.mode === 'ambassador' ? 'ambassador' : 'intake',
    locale: context.locale === 'ja' ? 'ja' : 'en',
    intent: parseContactIntent(context.intent),
    sessionId: typeof context.sessionId === 'string' && context.sessionId.trim() ? context.sessionId.trim() : '',
    source: normalizeContactSource(context.source),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STRUCTURED_LEAD_KEYS = [
  'purpose',
  'industryRole',
  'dataSensitivity',
  'stage',
  'timingBudget',
  'discoverySource',
  'contactReason',
] as const satisfies readonly (keyof StructuredLead)[];

function normalizeStructuredLead(value: unknown): StructuredLead {
  if (!isRecord(value)) return {};
  const result: StructuredLead = {};
  for (const key of STRUCTURED_LEAD_KEYS) {
    const field = value[key];
    if (typeof field !== 'string') continue;
    const normalized = field.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim().slice(0, 500);
    if (normalized) result[key] = normalized;
  }
  return result;
}

const TRANSCRIPT_ROLE_LINE = /^(?:user|assistant|system|human|visitor|cloudia|ユーザー|あなた|訪問者|アシスタント|クラウディア)\s*(?:[:：]|[-—])\s*/i;

function normalizeConfirmedSummaryText(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8000) return '';
  const lines = value.split(/\r?\n/);
  if (lines.some((line) => TRANSCRIPT_ROLE_LINE.test(line.trim()))) return '';
  return value;
}

function normalizeTurnstileToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const token = value.trim();
  return token && token.length <= 2048 ? token : undefined;
}

function normalizeConversationSummaryForSubmit(
  value: unknown,
  locale: Locale,
  intent: ContactIntent | null,
  classification: Classification | '',
  structuredLead: StructuredLead,
): string | ConversationSummaryV1 {
  if (typeof value === 'string') return normalizeConfirmedSummaryText(value);
  if (!isRecord(value) || value.version !== 1) return '';
  const text = normalizeConfirmedSummaryText(value.text);
  if (!text.trim()) return '';
  const stage = typeof value.stage === 'string' ? value.stage.trim().slice(0, 80) : '';
  const summaryClassification: Classification = classification
    || (value.classification === 'sales' || value.classification === 'spam' || value.classification === 'genuine'
      ? value.classification
      : 'genuine');
  return {
    version: 1,
    locale,
    intent,
    classification: summaryClassification,
    readyForContact: value.readyForContact === true,
    ...(stage ? { stage } : {}),
    ...(Object.keys(structuredLead).length > 0 ? { structuredLead } : {}),
    text,
  };
}

function parseChatResult(data: Record<string, unknown>, locale: Locale): ChatResult {
  const classification: Classification =
    data.classification === 'sales' || data.classification === 'spam' || data.classification === 'genuine'
      ? data.classification
      : 'genuine';
  const result: ChatResult = {
    reply: typeof data.reply === 'string' && data.reply.trim()
      ? data.reply.trim().slice(0, 8000)
      : locale === 'ja'
        ? '申し訳ありません、もう一度お聞かせいただけますか？'
        : 'Sorry, could you please tell me that again?',
    classification,
    readyForContact: data.readyForContact === true,
  };
  if (typeof data.sessionId === 'string' && data.sessionId.trim()) result.sessionId = data.sessionId.trim();
  if (typeof data.stage === 'string' && data.stage.trim()) result.stage = data.stage.trim();
  if (typeof data.summary === 'string' && data.summary.trim()) result.summary = data.summary.trim().slice(0, 4000);
  if (data.faqResolution === 'answered' || data.faqResolution === 'unresolved' || data.faqResolution === null) {
    result.faqResolution = data.faqResolution;
  }
  if (Array.isArray(data.missingFields)) {
    result.missingFields = data.missingFields.filter((value): value is string => typeof value === 'string').slice(0, 16);
  }
  if (isRecord(data.structuredLead)) {
    const structuredLead = normalizeStructuredLead(data.structuredLead);
    if (Object.keys(structuredLead).length > 0) result.structuredLead = structuredLead;
  }
  return result;
}

export interface SubmitPayload {
  sessionId?: string | null;
  idempotencyKey?: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  summaryText?: string | ConversationSummaryV1;
  /** @deprecated compatibility alias; use summaryText. */
  conversationSummary?: string;
  /** Server-validated, non-PII intake fields carried into /submit. */
  structuredLead?: StructuredLead;
  classification?: Classification | '';
  intent?: ContactIntent | null;
  locale?: Locale;
  source?: string;
  handoffConsent?: GriftHandoffConsent;
  turnstileToken?: string;
  website?: string; // honeypot — always ''
}

export interface SubmitResult {
  ok: boolean;
  /** HTTP response status; retained for existing callers. */
  status: number;
  receiptId?: string;
  deliveryStatus?: 'queued' | 'sent';
  duplicate?: boolean;
  handoff?: SubmitHandoff;
  body?: unknown;
}

export interface ConversationSummaryV1 {
  version: 1;
  locale: Locale;
  intent: ContactIntent | null;
  classification: Classification;
  readyForContact: boolean;
  stage?: string;
  structuredLead?: StructuredLead;
  text: string;
}

export interface GriftHandoffConsent {
  accepted: true;
  version: 'cloudia-grift-v1';
  acceptedAt: string;
  summaryConfirmed: true;
}

export type SubmitHandoff =
  | { status: 'ready'; url: string; expiresAt: string }
  | { status: 'fallback' };

function apiBase(): string {
  const base = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_CONTACT_API_BASE;
  if (base && base.trim()) return base.replace(/\/$/, '');
  return '';
}

function chatUrl(): string {
  return `${apiBase()}/api/contact/chat`;
}

function chatStartUrl(): string {
  return `${apiBase()}/api/contact/chat/start`;
}

function submitUrl(): string {
  return `${apiBase()}/api/contact/submit`;
}

export function isContactChatMock(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return env?.VITE_CONTACT_CHAT_MOCK === '1' || env?.VITE_CONTACT_CHAT_MOCK === 'true';
}

export function getFallbackContactUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return normalizeFallbackContactUrl(env?.VITE_FALLBACK_CONTACT_URL);
}

const DEFAULT_FALLBACK_EMAIL = 'mailto:cloudia@cor-jp.com';

function normalizedFallbackPath(pathname: string): string {
  let decoded = pathname;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '').toLowerCase() || '/';
}

export function normalizeFallbackContactUrl(value: unknown): string {
  const configured = typeof value === 'string' ? value.trim() : '';
  if (!configured || /[\r\n]/.test(configured) || /%0[ad]/i.test(configured)) return DEFAULT_FALLBACK_EMAIL;
  try {
    const url = new URL(configured);
    if (url.protocol === 'mailto:') {
      return !url.search
        && !url.hash
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname)
        ? url.toString()
        : DEFAULT_FALLBACK_EMAIL;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return DEFAULT_FALLBACK_EMAIL;
    const host = url.hostname.toLowerCase();
    const path = normalizedFallbackPath(url.pathname);
    const loopsToCloudia = (host === 'cor-jp.com' || host === 'www.cor-jp.com')
      && /^\/(?:(?:en|ja)\/)?contact(?:\/chat(?:\/.*)?)?$/.test(path);
    return loopsToCloudia ? DEFAULT_FALLBACK_EMAIL : url.toString();
  } catch {
    return DEFAULT_FALLBACK_EMAIL;
  }
}

/** 会話履歴を API messages 形式へ（system は送らない） */
export function toApiMessages(
  history: { sender: 'user' | 'ai'; text: string }[],
): ContactChatMessage[] {
  return history
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as ChatRole,
      content: m.text.trim().slice(0, 2000),
    }))
    .slice(-20);
}

export async function postContactChat(
  messages: ContactChatMessage[],
  context: ContactChatContext,
  options: ContactChatRequestOptions = {},
): Promise<ChatResult> {
  const normalizedContext = normalizeChatContext(context);
  if (isContactChatMock()) {
    const last = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    return {
      reply: normalizedContext.locale === 'ja'
        ? `（モック応答）「${last.slice(0, 80)}」について承知しました。もう少し詳しくお聞かせください。`
        : `(Mock response) I understand your question about “${last.slice(0, 80)}”. Could you tell me a little more?`,
      classification: 'genuine',
      readyForContact: messages.filter((m) => m.role === 'user').length >= 3,
    };
  }

  const res = await fetch(chatUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    signal: options.signal,
    body: JSON.stringify({
      messages,
      mode: normalizedContext.mode,
      locale: normalizedContext.locale,
      intent: normalizedContext.intent,
      source: normalizedContext.source,
      ...(normalizedContext.sessionId ? { sessionId: normalizedContext.sessionId } : {}),
    }),
  });
  if (!res.ok) {
    throw new ContactChatUnavailableError();
  }
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new ContactChatUnavailableError();
  }
  if (!isRecord(parsed)) throw new ContactChatUnavailableError();
  return parseChatResult(parsed, normalizedContext.locale);
}

/**
 * Starts an intake conversation after the visitor chooses an intent.
 * The selected intent is carried as context; no synthetic user message is
 * added to the visible conversation history.
 */
export async function postContactChatStart(
  messages: ContactChatMessage[],
  context: ContactChatStartContext,
  options: ContactChatRequestOptions = {},
): Promise<ChatResult> {
  const normalizedContext = normalizeChatContext(context);
  if (isContactChatMock()) {
    return {
      reply: normalizedContext.locale === 'ja'
        ? 'ご相談の目的を確認しました。まず、業種やお役割、現在のお困りごとを教えてください。'
        : 'Thanks, I have your inquiry purpose. First, could you tell me about your industry, role, and current challenge?',
      classification: 'genuine',
      readyForContact: false,
    };
  }

  const res = await fetch(chatStartUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    signal: options.signal,
    body: JSON.stringify({
      messages,
      mode: normalizedContext.mode,
      locale: normalizedContext.locale,
      intent: normalizedContext.intent,
      source: normalizedContext.source,
      ...(normalizedContext.sessionId ? { sessionId: normalizedContext.sessionId } : {}),
      start: true,
      event: 'intent_selected',
    }),
  });
  if (!res.ok) {
    throw new ContactChatUnavailableError();
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new ContactChatUnavailableError();
  }
  if (!isRecord(parsed)) throw new ContactChatUnavailableError();
  return parseChatResult(parsed, normalizedContext.locale);
}

export async function postContactSubmit(
  payload: SubmitPayload,
  options: ContactChatRequestOptions = {},
): Promise<SubmitResult> {
  const intent = parseContactIntent(payload.intent);
  const locale = normalizeLocale(payload.locale, 'ja');
  const source = normalizeContactSource(payload.source);
  const structuredLead = normalizeStructuredLead(payload.structuredLead);
  const classification = payload.classification === 'genuine'
    || payload.classification === 'sales'
    || payload.classification === 'spam'
    ? payload.classification
    : '';
  const summaryText = normalizeConversationSummaryForSubmit(
    payload.summaryText ?? payload.conversationSummary ?? '',
    locale,
    intent,
    classification,
    structuredLead,
  );
  const hasConfirmedSummary = typeof summaryText !== 'string';
  const consent = normalizeGriftHandoffConsent(intent, payload.handoffConsent, hasConfirmedSummary);
  const turnstileToken = normalizeTurnstileToken(payload.turnstileToken);
  // Worker 未対応の intent でも届くよう summary / message 先頭にも intent を埋め込む
  const intentTag = intent ? `[intent:${intent}] ` : '';
  const body = {
    sessionId: payload.sessionId || undefined,
    idempotencyKey: payload.idempotencyKey,
    name: payload.name,
    email: payload.email,
    company: payload.company ?? '',
    message: intentTag + (payload.message || ''),
    // Worker側で検証済み要約として扱う。生トランスクリプトはここへ渡さない。
    summaryText,
    ...(Object.keys(structuredLead).length > 0
      ? { structuredLead }
      : {}),
    classification,
    intent: intent ?? undefined,
    locale,
    source,
    ...(consent ? { handoffConsent: consent } : {}),
    ...(turnstileToken ? { turnstileToken } : {}),
    website: payload.website ?? '',
  };

  if (isContactChatMock()) {
    return parseSubmitResult({ ok: true, mock: true }, 200, Boolean(consent));
  }

  const res = await fetch(submitUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    signal: options.signal,
    body: JSON.stringify(body),
  });
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = undefined;
  }
  if (!res.ok) {
    throw new ContactChatUnavailableError();
  }
  return parseSubmitResult(parsed, res.status, Boolean(consent));
}

function normalizeGriftHandoffConsent(
  intent: ContactIntent | null,
  consent: GriftHandoffConsent | undefined,
  hasConfirmedSummary: boolean,
): GriftHandoffConsent | undefined {
  if (
    !isGriftHandoffIntent(intent)
    || !hasConfirmedSummary
    || !consent?.accepted
    || consent.version !== 'cloudia-grift-v1'
    || consent.summaryConfirmed !== true
  ) {
    return undefined;
  }
  const acceptedAt = typeof consent.acceptedAt === 'string' ? consent.acceptedAt.trim() : '';
  if (!acceptedAt || Number.isNaN(Date.parse(acceptedAt))) return undefined;
  return {
    accepted: true,
    version: 'cloudia-grift-v1',
    acceptedAt: new Date(acceptedAt).toISOString(),
    summaryConfirmed: true,
  };
}

function parseSubmitResult(data: unknown, httpStatus: number, handoffRequested: boolean): SubmitResult {
  const result: SubmitResult = { ok: true, status: httpStatus, body: data };
  if (!isRecord(data)) return result;
  if (typeof data.receiptId === 'string' && data.receiptId.trim()) {
    result.receiptId = data.receiptId.trim();
  }
  if (data.status === 'queued' || data.status === 'sent') result.deliveryStatus = data.status;
  if (typeof data.duplicate === 'boolean') result.duplicate = data.duplicate;
  if (handoffRequested && isRecord(data.handoff)) {
    if (data.handoff.status === 'fallback') {
      result.handoff = { status: 'fallback' };
    } else if (data.handoff.status === 'ready') {
      const url = parseAllowedGriftHandoffUrl(data.handoff.url);
      const expiresAt = parseValidGriftHandoffExpiry(data.handoff.expiresAt);
      if (!url || !expiresAt) {
        result.handoff = { status: 'fallback' };
      } else {
        result.handoff = { status: 'ready', url, expiresAt };
      }
    }
  }
  return result;
}
