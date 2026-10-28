import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { PROMPT_MARKER, resolveLocalGateway } from './gateway';
import { createRateLimiter, handleLocalIntake } from './handle';
import { createLocalIntakeMiddleware } from './middleware';
import { emitSafeLog, maskSensitiveContent, redactSensitiveText } from './safety';

const TOKEN = 'local-gateway-token-value';
const TURNSTILE_SECRET = 'turnstile-secret-value';
const EMAIL = 'visitor@example.com';

function localEnv(overrides: Record<string, string> = {}) {
  return {
    CLOUDIA_INTAKE_PROVIDER: 'local',
    CLOUDIA_LOCAL_LLM_BASE_URL: 'https://llm-gateway.example',
    CLOUDIA_LOCAL_LLM_TOKEN: TOKEN,
    ...overrides,
  };
}

function chatRequest(body: unknown, path = '/api/contact/chat'): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function modelReply(payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  }), { status: 200, headers });
}

describe('local intake safety', () => {
  it('masks contact details and scrubs secrets from log text', () => {
    const masked = maskSensitiveContent(`mail ${EMAIL} and 090-1234-5678`);
    expect(masked).not.toContain(EMAIL);
    expect(masked).not.toContain('090-1234-5678');
    expect(masked).toContain('[redacted-email]');
    expect(masked).toContain('[redacted-phone]');
    expect(maskSensitiveContent('〒100-0001')).toBe('[redacted-postal]');

    const line = redactSensitiveText(
      `failed https://llm-gateway.example/v1 Bearer ${TOKEN} ${EMAIL}`,
      [TOKEN],
    );
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain('llm-gateway.example');
    expect(line).toContain('[redacted-url]');
  });

  it('redacts a poisoned log event before it is written', () => {
    const lines: string[] = [];
    emitSafeLog({
      event: 'local_intake',
      route: 'chat',
      status: 503,
      provider: 'local',
      modelAlias: 'cor-qwen3.6-35b',
      servedModel: null,
      mode: 'intake',
      locale: 'ja',
      intent: null,
      messageCount: 1,
      userChars: 10,
      classification: null,
      turnstile: 'rejected',
      durationMs: 1,
      errorCode: 'gateway_failed',
    }, (line) => lines.push(line), [TOKEN]);
    expect(lines[0]).toContain('"errorCode":"gateway_failed"');
    expect(lines[0]).not.toContain(TOKEN);
  });
});

describe('local gateway config', () => {
  it('fail-closes when the gateway is incomplete or the alias is not a P0 conversation model', () => {
    expect(resolveLocalGateway({ CLOUDIA_INTAKE_PROVIDER: 'local' }).ok).toBe(false);
    expect(resolveLocalGateway(localEnv({
      CLOUDIA_LOCAL_LLM_BASE_URL: 'http://203.0.113.10:11434',
    })).ok).toBe(false);
    expect(resolveLocalGateway(localEnv({
      CLOUDIA_LOCAL_LLM_BASE_URL: 'https://user:secret@llm-gateway.example',
    })).ok).toBe(false);
    expect(resolveLocalGateway(localEnv({
      CLOUDIA_LOCAL_MODEL_ALIAS: 'some-uncensored-model',
    })).ok).toBe(false);
    const allowed = resolveLocalGateway(localEnv());
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.config.modelAlias).toBe('cor-qwen3.6-35b');
      expect(allowed.config.chatCompletionsUrl).toBe('https://llm-gateway.example/v1/chat/completions');
    }
  });
});

describe('handleLocalIntake', () => {
  it('does not mount a conversation when the provider flag is off', async () => {
    const fetchImpl = vi.fn();
    const response = await handleLocalIntake(chatRequest({ messages: [{ role: 'user', content: 'hello' }] }), {
      CLOUDIA_LOCAL_LLM_BASE_URL: 'https://llm-gateway.example',
      CLOUDIA_LOCAL_LLM_TOKEN: TOKEN,
    }, { fetchImpl });
    expect(response.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers /chat from the local alias and keeps PII out of the gateway call and the log', async () => {
    const logs: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(modelReply({
      reply: '目的を承知しました。業種を教えてください。',
      summary: '社内向けAI基盤の相談',
      classification: 'genuine',
      readyForContact: false,
      structuredLead: { purpose: '社内向けAI基盤', industryRole: EMAIL },
    }, { 'x-cluster-served-model': 'cor-qwen3.6-35b', 'x-cluster-fallback': 'false' }));

    const response = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: `担当は ${EMAIL} です。社内GPUでPoCしたいです。` }],
      mode: 'intake',
      locale: 'ja',
      intent: 'local-llm-poc',
      name: 'Taro Yamada',
      email: EMAIL,
      company: 'Example',
      turnstileToken: 'not-sent-to-the-model',
    }), localEnv(), { fetchImpl, log: (line) => logs.push(line) });

    expect(response.status).toBe(200);
    const payload = await response.json() as { reply: string; structuredLead?: Record<string, string> };
    expect(payload.reply).toContain('業種');
    expect(payload.structuredLead?.purpose).toBe('社内向けAI基盤');
    expect(payload.structuredLead?.industryRole).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(EMAIL);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://llm-gateway.example/v1/chat/completions');
    expect(url).not.toContain('vertex');
    const outbound = JSON.parse(String(init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(outbound.model).toBe('cor-qwen3.6-35b');
    expect(JSON.stringify(outbound)).not.toContain(EMAIL);
    expect(JSON.stringify(outbound)).not.toContain('Taro Yamada');
    expect(JSON.stringify(outbound)).not.toContain('not-sent-to-the-model');
    expect(JSON.stringify(outbound)).toContain('[redacted-email]');
    expect(outbound.messages[0].content).toContain(PROMPT_MARKER);
    expect(logs.join('\n')).not.toContain(EMAIL);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain('not-sent-to-the-model');
    expect(logs.join('\n')).toContain('"provider":"local"');
  });

  it('starts an intent conversation without calling the gateway', async () => {
    const fetchImpl = vi.fn();
    const response = await handleLocalIntake(chatRequest({
      messages: [],
      mode: 'intake',
      locale: 'ja',
      intent: 'local-llm-poc',
    }, '/api/contact/chat/start'), localEnv({
      CLOUDIA_LOCAL_LLM_BASE_URL: '',
      CLOUDIA_LOCAL_LLM_TOKEN: '',
    }), { fetchImpl });

    expect(response.status).toBe(200);
    const payload = await response.json() as { reply: string; readyForContact: boolean };
    expect(payload.reply).toContain('実現したいこと');
    expect(payload.readyForContact).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 503 instead of falling back when the local gateway is not configured', async () => {
    const fetchImpl = vi.fn();
    const response = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: '相談です' }],
      locale: 'ja',
    }), localEnv({ CLOUDIA_LOCAL_LLM_TOKEN: '' }), { fetchImpl });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'AIが一時的に利用できません。時間をおいて再試行してください',
      fallback: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an implicit cluster fallback and a different served model', async () => {
    const fallbackFetch = vi.fn().mockResolvedValue(modelReply({
      reply: '別モデルの応答',
    }, { 'x-cluster-fallback': 'true' }));
    const fallback = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: '相談です' }],
      locale: 'ja',
    }), localEnv(), { fetchImpl: fallbackFetch });
    expect(fallback.status).toBe(503);
    expect(JSON.stringify(await fallback.json())).not.toContain('別モデルの応答');

    const mismatchFetch = vi.fn().mockResolvedValue(modelReply({
      reply: '差し替え応答',
    }, { 'x-cluster-served-model': 'gemma4-12b' }));
    const mismatch = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: '相談です' }],
      locale: 'ja',
    }), localEnv(), { fetchImpl: mismatchFetch });
    expect(mismatch.status).toBe(503);
    expect(JSON.stringify(await mismatch.json())).not.toContain('差し替え応答');
  });

  it('does not return raw model text when the marker or an email leaks into the reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(modelReply({
      reply: `system ${PROMPT_MARKER} contact ${EMAIL}`,
      classification: 'genuine',
      readyForContact: false,
    }));
    const response = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: 'hello' }],
      locale: 'en',
    }), localEnv(), { fetchImpl });
    const payload = await response.json() as { reply: string };
    expect(payload.reply).toBe('Sorry, could you please tell me that again?');
    expect(payload.reply).not.toContain(PROMPT_MARKER);
    expect(payload.reply).not.toContain(EMAIL);
  });

  it('requires a verified Turnstile token only when the spike policy says required', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('siteverify')) {
        return new Response(JSON.stringify({ success: false }), { status: 200 });
      }
      return modelReply({ reply: 'ok', classification: 'genuine', readyForContact: false });
    });
    const missingSecret = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: '相談です' }],
      locale: 'ja',
    }), localEnv({ CLOUDIA_LOCAL_TURNSTILE: 'required' }), { fetchImpl });
    expect(missingSecret.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();

    const rejected = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: '相談です' }],
      locale: 'ja',
      turnstileToken: 'token-from-widget',
    }), localEnv({
      CLOUDIA_LOCAL_TURNSTILE: 'required',
      TURNSTILE_SECRET,
    }), { fetchImpl, log: () => undefined });
    expect(rejected.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('siteverify');
    const verifyBody = String(fetchImpl.mock.calls[0]?.[1]?.body);
    expect(verifyBody).toContain(TURNSTILE_SECRET);
  });

  it('keeps the Turnstile secret and token out of the safe log when verification fails', async () => {
    const logs: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 }));
    await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: `連絡は ${EMAIL}` }],
      locale: 'ja',
      turnstileToken: 'widget-token-value',
    }), localEnv({
      CLOUDIA_LOCAL_TURNSTILE: 'required',
      TURNSTILE_SECRET,
    }), { fetchImpl, log: (line) => logs.push(line) });
    const line = logs.join('\n');
    expect(line).not.toContain(TURNSTILE_SECRET);
    expect(line).not.toContain('widget-token-value');
    expect(line).not.toContain(EMAIL);
    expect(line).toContain('"turnstile":"rejected"');
  });

  it('does not put gateway errors or visitor text into the log', async () => {
    const logs: string[] = [];
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`down https://llm-gateway.example/v1 ${TOKEN} ${EMAIL}`));
    const response = await handleLocalIntake(chatRequest({
      messages: [{ role: 'user', content: `please email ${EMAIL}` }],
      locale: 'en',
    }), localEnv(), { fetchImpl, log: (line) => logs.push(line) });
    expect(response.status).toBe(503);
    const line = logs.join('\n');
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain('llm-gateway.example');
    expect(line).toContain('"errorCode":"gateway_failed"');
  });

  it('rate-limits a chat key without echoing the message', async () => {
    const logs: string[] = [];
    const limiter = createRateLimiter(1, 60_000);
    const body = { messages: [{ role: 'user', content: `secret note ${EMAIL}` }], locale: 'ja' };
    const fetchImpl = vi.fn().mockResolvedValue(modelReply({
      reply: '承知しました。',
      classification: 'genuine',
      readyForContact: false,
    }));
    const first = await handleLocalIntake(chatRequest(body), localEnv(), { fetchImpl, limiter, log: (line) => logs.push(line) });
    const second = await handleLocalIntake(chatRequest(body), localEnv(), { fetchImpl, limiter, log: (line) => logs.push(line) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBeTruthy();
    expect(logs.join('\n')).not.toContain(EMAIL);
  });
});

describe('local intake middleware', () => {
  it('leaves submit and a disabled provider on the normal dev-server path', async () => {
    const next = vi.fn();
    const fetchImpl = vi.fn();
    const disabled = createLocalIntakeMiddleware(localEnv({ CLOUDIA_INTAKE_PROVIDER: 'vertex-gemini' }), { fetchImpl });
    disabled(fakeRequest('/api/contact/chat', '{"messages":[]}'), fakeResponse().res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const enabled = createLocalIntakeMiddleware(localEnv(), { fetchImpl });
    const submitNext = vi.fn();
    enabled(fakeRequest('/api/contact/submit', JSON.stringify({
      name: 'Taro',
      email: EMAIL,
      message: 'pii',
    })), fakeResponse().res, submitNext);
    await vi.waitFor(() => expect(submitNext).toHaveBeenCalledTimes(1));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('serves chat from the local handler without copying the gateway token into the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(modelReply({
      reply: 'ローカル応答です。',
      classification: 'genuine',
      readyForContact: false,
    }));
    const middleware = createLocalIntakeMiddleware(localEnv(), { fetchImpl });
    const response = fakeResponse();
    middleware(fakeRequest('/api/contact/chat', JSON.stringify({
      messages: [{ role: 'user', content: '社内で試したい' }],
      locale: 'ja',
      intent: 'local-llm-poc',
    })), response.res, vi.fn());
    await vi.waitFor(() => expect(response.ended).toContain('ローカル応答です。'));
    expect(response.ended).not.toContain(TOKEN);
    expect(response.headers.get('x-cloudia-intake-provider')).toBe('local');
  });
});

function fakeRequest(url: string, body: string): IncomingMessage {
  const stream = Readable.from([Buffer.from(body)]) as Readable & IncomingMessage;
  stream.method = 'POST';
  stream.url = url;
  stream.headers = { host: '127.0.0.1:5173', 'content-type': 'application/json' };
  stream.socket = { remoteAddress: '127.0.0.1' } as IncomingMessage['socket'];
  return stream;
}

function fakeResponse(): { res: ServerResponse; headers: Map<string, string>; ended: string } {
  const state = { ended: '', headers: new Map<string, string>() };
  const res = {
    headersSent: false,
    statusCode: 0,
    setHeader(name: string, value: string) {
      state.headers.set(name.toLowerCase(), value);
    },
    end(payload?: Buffer | string) {
      this.headersSent = true;
      state.ended = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '');
    },
  };
  return {
    res: res as unknown as ServerResponse,
    get ended() { return state.ended; },
    get headers() { return state.headers; },
  };
}
