/**
 * corsweb workers/contact-chat クライアント（ADR-0003）。
 * 本番: 同一オリジン相対パス。開発: VITE_CONTACT_API_BASE。
 */
import type { AppMode, ContactIntent } from '../types';
import type { Locale } from '../translations';
import { parseContactIntent } from '../constants/intents';

export type ChatRole = 'user' | 'assistant';

export interface ContactChatMessage {
  role: ChatRole;
  content: string;
}

export type Classification = 'genuine' | 'sales' | 'spam';

/** Non-PII fields collected by the Worker during structured intake. */
export interface StructuredLead {
  [key: string]: string | undefined;
  purpose?: string;
  industryRole?: string;
  dataSensitivity?: string;
  stage?: string;
  timingBudget?: string;
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
  source?: 'cloudia';
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
    source: 'cloudia',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    result.structuredLead = Object.fromEntries(
      Object.entries(data.structuredLead).filter(([, value]) => typeof value === 'string').slice(0, 8),
    ) as StructuredLead;
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
  summaryText?: string;
  /** @deprecated compatibility alias; use summaryText. */
  conversationSummary?: string;
  /** Server-validated, non-PII intake fields carried into /submit. */
  structuredLead?: StructuredLead;
  classification?: Classification | '';
  intent?: ContactIntent | null;
  source?: string;
  turnstileToken?: string;
  website?: string; // honeypot — always ''
}

export interface SubmitResult {
  ok: boolean;
  status: number;
  body?: unknown;
}

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
  return env?.VITE_FALLBACK_CONTACT_URL || 'https://cor-jp.com/contact/';
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

export function buildConversationSummary(
  history: { sender: 'user' | 'ai'; text: string }[],
  intent?: ContactIntent | null,
): string {
  const lines = history.map((m) => `${m.sender === 'user' ? 'User' : 'Cloudia'}: ${m.text}`);
  const intentLine = intent ? `[intent:${intent}]\n` : '';
  return (intentLine + lines.join('\n')).slice(0, 8000);
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
  // Worker 未対応の intent でも届くよう summary / message 先頭にも intent を埋め込む
  const intentTag = payload.intent ? `[intent:${payload.intent}] ` : '';
  const body = {
    sessionId: payload.sessionId || undefined,
    idempotencyKey: payload.idempotencyKey,
    name: payload.name,
    email: payload.email,
    company: payload.company ?? '',
    message: intentTag + (payload.message || ''),
    // Worker側で検証済み要約として扱う。生トランスクリプトはここへ渡さない。
    summaryText: payload.summaryText ?? payload.conversationSummary ?? '',
    ...(payload.structuredLead && Object.keys(payload.structuredLead).length > 0
      ? { structuredLead: payload.structuredLead }
      : {}),
    classification: payload.classification ?? '',
    intent: payload.intent ?? undefined,
    source: payload.source ?? 'cloudia',
    turnstileToken: payload.turnstileToken,
    website: payload.website ?? '',
  };

  if (isContactChatMock()) {
    return { ok: true, status: 200, body: { ok: true, mock: true } };
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
  return { ok: true, status: res.status, body: parsed };
}
