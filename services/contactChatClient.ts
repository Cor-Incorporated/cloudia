/**
 * corsweb workers/contact-chat クライアント（ADR-0003）。
 * 本番: 同一オリジン相対パス。開発: VITE_CONTACT_API_BASE。
 */
import { ContactIntent } from '../types';

export type ChatRole = 'user' | 'assistant';

export interface ContactChatMessage {
  role: ChatRole;
  content: string;
}

export type Classification = 'genuine' | 'sales' | 'spam';

export interface ChatResult {
  reply: string;
  classification: Classification;
  readyForContact: boolean;
}

export interface SubmitPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
  conversationSummary?: string;
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
): Promise<ChatResult> {
  if (isContactChatMock()) {
    const last = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    return {
      reply: `（モック応答）「${last.slice(0, 80)}」について承知しました。もう少し詳しくお聞かせください。`,
      classification: 'genuine',
      readyForContact: messages.filter((m) => m.role === 'user').length >= 3,
    };
  }

  const res = await fetch(chatUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`chat failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as Partial<ChatResult>;
  const classification: Classification =
    data.classification === 'sales' || data.classification === 'spam' || data.classification === 'genuine'
      ? data.classification
      : 'genuine';
  return {
    reply: typeof data.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : '申し訳ありません、もう一度お聞かせいただけますか？',
    classification,
    readyForContact: Boolean(data.readyForContact),
  };
}

export async function postContactSubmit(payload: SubmitPayload): Promise<SubmitResult> {
  // Worker 未対応の intent でも届くよう summary / message 先頭にも intent を埋め込む
  const intentTag = payload.intent ? `[intent:${payload.intent}] ` : '';
  const body = {
    name: payload.name,
    email: payload.email,
    company: payload.company ?? '',
    message: intentTag + (payload.message || ''),
    conversationSummary: payload.conversationSummary ?? '',
    classification: payload.classification ?? '',
    intent: payload.intent ?? undefined,
    source: payload.source ?? 'cloudia',
    turnstileToken: payload.turnstileToken,
    website: payload.website ?? '',
  };

  if (isContactChatMock()) {
    console.info('[contact-chat mock submit]', body);
    return { ok: true, status: 200, body: { ok: true, mock: true } };
  }

  const res = await fetch(submitUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = undefined;
  }
  if (!res.ok) {
    throw new Error(`submit failed: ${res.status}`);
  }
  return { ok: true, status: res.status, body: parsed };
}
