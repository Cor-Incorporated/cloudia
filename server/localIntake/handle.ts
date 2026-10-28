/**
 * Feature-flagged local contact intake.
 * Production stays on corsweb /api/contact/chat (Vertex) unless
 * CLOUDIA_INTAKE_PROVIDER=local. This handler never calls Vertex and
 * never accepts /submit (PII stays on the contact-chat Worker).
 */
import {
  buildLocalSystemPrompt,
  completeLocalIntake,
  isLocalIntakeEnabled,
  LocalGatewayError,
  normalizeIntent,
  parseLocalModelOutput,
  resolveLocalGateway,
  type LocalIntakeEnv,
} from './gateway';
import {
  emitSafeLog,
  evaluateTurnstile,
  maskMessages,
  type ChatTurn,
  type LocalIntakeErrorCode,
  type SafeLogEvent,
  type TurnstileLogState,
} from './safety';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LEN = 2000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export interface RateLimitDecision {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now: number): RateLimitDecision;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter & { reset(): void } {
  const buckets = new Map<string, { n: number; resetAt: number }>();
  return {
    reset() {
      buckets.clear();
    },
    check(key: string, now: number): RateLimitDecision {
      if (buckets.size > 10000) buckets.clear();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { n: 1, resetAt: now + windowMs });
        return { limited: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }
      existing.n += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { limited: existing.n > max, retryAfterSeconds };
    },
  };
}

const sharedLimiter = createRateLimiter(20, 60_000);

export interface LocalIntakeDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (line: string) => void;
  limiter?: RateLimiter;
  clientIp?: string;
}

const CLIENT_ERROR = {
  ja: 'AIが一時的に利用できません。時間をおいて再試行してください',
  en: 'The assistant is temporarily unavailable. Please try again shortly.',
} as const;

function statusFor(code: LocalIntakeErrorCode): number {
  switch (code) {
    case 'invalid_json':
    case 'invalid_messages':
    case 'invalid_context':
    case 'turnstile_required':
      return 400;
    case 'turnstile_failed':
      return 403;
    case 'rate_limited':
      return 429;
    case 'body_too_large':
      return 413;
    case 'turnstile_unconfigured':
    case 'gateway_unconfigured':
    case 'model_rejected':
    case 'gateway_failed':
    case 'served_model_mismatch':
    case 'implicit_fallback':
      return 503;
    default: {
      const neverCode: never = code;
      return neverCode;
    }
  }
}

function json(data: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-cloudia-intake-provider': 'local',
      ...extraHeaders,
    },
  });
}

function nowMs(deps: LocalIntakeDeps): number {
  return deps.now ? deps.now() : Date.now();
}

export async function handleLocalIntake(request: Request, env: LocalIntakeEnv, deps: LocalIntakeDeps = {}): Promise<Response> {
  const started = nowMs(deps);
  const url = new URL(request.url);
  const route: SafeLogEvent['route'] = url.pathname === '/api/contact/chat/start' ? 'chat_start' : 'chat';
  const secrets = secretValues(env);
  const logLine = deps.log ?? (() => undefined);
  const baseLog = {
    event: 'local_intake' as const,
    route,
    provider: 'local' as const,
    modelAlias: null,
    servedModel: null,
    mode: null,
    locale: null,
    intent: null,
    messageCount: 0,
    userChars: 0,
    classification: null,
    turnstile: 'not_required' as TurnstileLogState,
    errorCode: null,
  };

  const finish = (response: Response, patch: Partial<SafeLogEvent>): Response => {
    const event: SafeLogEvent = {
      ...baseLog,
      ...patch,
      route: patch.route ?? route,
      status: response.status,
      durationMs: Math.max(0, nowMs(deps) - started),
    };
    emitSafeLog(event, logLine, secrets);
    return response;
  };

  if (!isLocalIntakeEnabled(env) || request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (url.pathname !== '/api/contact/chat' && url.pathname !== '/api/contact/chat/start') {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!/application\/json/i.test(contentType)) {
    return finish(json({ error: 'リクエストボディが不正なJSONです' }, 400), { errorCode: 'invalid_json' });
  }

  const limiter = deps.limiter ?? sharedLimiter;
  const limit = limiter.check(`chat:${deps.clientIp || 'local'}`, nowMs(deps));
  if (limit.limited) {
    return finish(json(
      { error: 'リクエストが多すぎます。少し待ってから再試行してください' },
      429,
      { 'retry-after': String(limit.retryAfterSeconds) },
    ), { errorCode: 'rate_limited', turnstile: 'not_required' });
  }

  const encoded = new TextEncoder().encode(await request.text());
  if (encoded.byteLength > MAX_BODY_BYTES) {
    return finish(json({ error: CLIENT_ERROR.ja }, 413), { errorCode: 'body_too_large' });
  }
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(encoded)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return finish(json({ error: 'リクエストボディが不正なJSONです' }, 400), { errorCode: 'invalid_json' });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return finish(json({ error: 'リクエストボディが不正なJSONです' }, 400), { errorCode: 'invalid_json' });
  }

  if (body.mode !== undefined && body.mode !== 'intake' && body.mode !== 'ambassador') {
    return finish(json({ error: 'mode は intake か ambassador のみ許可されます' }, 400), { errorCode: 'invalid_context' });
  }
  if (body.locale !== undefined && body.locale !== 'ja' && body.locale !== 'en') {
    return finish(json({ error: 'locale は ja か en のみ許可されます' }, 400), { errorCode: 'invalid_context' });
  }
  const mode = body.mode === 'ambassador' ? 'ambassador' : 'intake';
  const locale = body.locale === 'en' ? 'en' : 'ja';
  const intent = normalizeIntent(body.intent);

  const gateway = resolveLocalGateway(env);
  const turnstile = await evaluateTurnstile({
    policy: gateway.ok ? gateway.config.turnstilePolicy : (env.CLOUDIA_LOCAL_TURNSTILE || '').trim().toLowerCase() === 'required' ? 'required' : 'optional',
    token: body.turnstileToken,
    secret: env.TURNSTILE_SECRET,
    remoteIp: deps.clientIp,
    fetchImpl: deps.fetchImpl,
  });
  if (turnstile.action === 'deny') {
    const message = turnstile.errorCode === 'turnstile_required'
      ? 'Turnstile トークンが必要です'
      : CLIENT_ERROR[locale];
    return finish(json({ error: message }, turnstile.status), {
      mode,
      locale,
      intent,
      turnstile: turnstile.state,
      errorCode: turnstile.errorCode,
      modelAlias: gateway.ok ? gateway.config.modelAlias : null,
    });
  }

  const isStart = route === 'chat_start' || body.start === true || body.event === 'intent_selected';
  if (isStart) {
    const sessionId = safeSessionId(body.sessionId);
    return finish(json({
      reply: startReply(mode, locale, intent),
      classification: 'genuine',
      readyForContact: false,
      summary: intent
        ? (locale === 'en' ? `Inquiry intent: ${intent}` : `相談目的: ${intent}`)
        : (locale === 'en' ? 'Summary unavailable; the team will review the inquiry.' : '要約未生成（受付内容を担当者が確認します）'),
      ...(intent ? { intent } : {}),
      sessionId,
      stage: 'intent',
      missingFields: ['purpose'],
    }, 200), {
      route: 'chat_start',
      mode,
      locale,
      intent,
      classification: 'genuine',
      turnstile: turnstile.state,
      modelAlias: gateway.ok ? gateway.config.modelAlias : null,
    });
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.ok) {
    return finish(json({ error: messages.error }, messages.status), {
      mode,
      locale,
      intent,
      turnstile: turnstile.state,
      errorCode: 'invalid_messages',
    });
  }
  if (!gateway.ok) {
    return finish(json({ error: CLIENT_ERROR[locale], fallback: true }, statusFor(gateway.errorCode)), {
      mode,
      locale,
      intent,
      messageCount: messages.messages.length,
      userChars: userChars(messages.messages),
      turnstile: turnstile.state,
      errorCode: gateway.errorCode,
    });
  }

  const masked = maskMessages(messages.messages);
  try {
    const completion = await completeLocalIntake({
      config: gateway.config,
      system: buildLocalSystemPrompt({ mode, locale, intent }),
      messages: masked,
      fetchImpl: deps.fetchImpl,
      signal: request.signal,
    });
    const parsed = parseLocalModelOutput(completion.content, { locale, intent });
    const sessionId = safeSessionId(body.sessionId);
    return finish(json({
      reply: parsed.reply,
      classification: parsed.classification,
      readyForContact: parsed.readyForContact,
      summary: parsed.summary,
      ...(parsed.structuredLead ? { structuredLead: parsed.structuredLead } : {}),
      missingFields: parsed.missingFields,
      sessionId,
      stage: parsed.stage,
      ...(intent ? { intent } : {}),
    }, 200), {
      mode,
      locale,
      intent,
      messageCount: masked.length,
      userChars: userChars(masked),
      classification: parsed.classification,
      turnstile: turnstile.state,
      modelAlias: gateway.config.modelAlias,
      servedModel: completion.servedModel,
    });
  } catch (error) {
    const code: LocalIntakeErrorCode = error instanceof LocalGatewayError ? error.errorCode : 'gateway_failed';
    const headers: Record<string, string> = {};
    if (error instanceof LocalGatewayError && error.retryAfter) headers['retry-after'] = error.retryAfter;
    return finish(json({ error: CLIENT_ERROR[locale], fallback: true }, statusFor(code), headers), {
      mode,
      locale,
      intent,
      messageCount: masked.length,
      userChars: userChars(masked),
      turnstile: turnstile.state,
      errorCode: code,
      modelAlias: gateway.config.modelAlias,
    });
  }
}

function secretValues(env: LocalIntakeEnv): string[] {
  return [env.CLOUDIA_LOCAL_LLM_TOKEN, env.TURNSTILE_SECRET]
    .map((value) => value?.trim() || '')
    .filter((value) => value.length >= 8);
}

function userChars(messages: ChatTurn[]): number {
  return messages.filter((message) => message.role === 'user').reduce((sum, message) => sum + message.content.length, 0);
}

function safeSessionId(raw: unknown): string {
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(raw.trim())) return raw.trim();
  return crypto.randomUUID();
}

function startReply(mode: 'intake' | 'ambassador', locale: 'ja' | 'en', intent: string | null): string {
  if (intent === 'press-speaking-other') {
    return locale === 'en'
      ? 'Thanks. This is a press, speaking, or other public-outreach request. What type of opportunity and topic would you like to discuss?'
      : 'ありがとうございます。取材・登壇・その他の対外相談ですね。まず、ご希望の種類とテーマを教えてください。';
  }
  if (mode === 'ambassador') {
    return locale === 'en'
      ? 'Hello. I am Cloudia from Cor. This is the casual conversation mode. Ask about our services, and I can guide you to the formal inquiry flow when a concrete project comes up.'
      : 'こんにちは。Cor.株式会社のCloudiaです。こちらは雑談モードです。会社や技術についてご質問があればお聞かせください。具体的なご相談になった場合は、受付へご案内します。';
  }
  return locale === 'en'
    ? 'Thank you. I will ask a few quick questions so we can understand your request. What would you like to achieve?'
    : 'ありがとうございます。ご相談内容を把握するため、いくつか質問します。まず、今回実現したいことを教えてください。';
}

function normalizeMessages(input: unknown): { ok: true; messages: ChatTurn[] } | { ok: false; error: string; status: number } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'messages は1件以上の配列が必要です', status: 400 };
  }
  if (input.length > MAX_MESSAGES) {
    return { ok: false, error: `メッセージ数が多すぎます（最大${MAX_MESSAGES}件）`, status: 400 };
  }
  const messages: ChatTurn[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'messages の各要素はオブジェクトである必要があります', status: 400 };
    }
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: 'role は user か assistant のみ許可されます', status: 400 };
    }
    if (typeof content !== 'string') {
      return { ok: false, error: 'content は文字列である必要があります', status: 400 };
    }
    const clean = content.replace(CONTROL_CHARS, ' ').replace(/\r\n?/g, '\n').trim().slice(0, MAX_MESSAGE_LEN);
    if (!clean) return { ok: false, error: '空のメッセージは送れません', status: 400 };
    messages.push({ role, content: clean });
  }
  return { ok: true, messages };
}
