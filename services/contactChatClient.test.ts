import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContactChatUnavailableError,
  postContactChat,
  postContactChatStart,
  postContactSubmit,
  toApiMessages,
} from './contactChatClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('contactChatClient', () => {
  it('starts an intent-scoped conversation without a synthetic user message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: 'まず業種を教えてください。',
      classification: 'genuine',
      readyForContact: false,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactChatStart([{ role: 'assistant', content: 'ようこそ。' }], {
      mode: 'intake',
      locale: 'ja',
      intent: 'local-llm-poc',
      source: 'cloudia',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/contact/chat/start');
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [{ role: 'assistant', content: 'ようこそ。' }],
      mode: 'intake',
      locale: 'ja',
      intent: 'local-llm-poc',
      source: 'cloudia',
      start: true,
      event: 'intent_selected',
    });
  });

  it('does not expose start endpoint response details through errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'secret start failure details',
      { status: 503 },
    )));

    const error = await postContactChatStart([], {
      mode: 'intake',
      locale: 'en',
      intent: 'contract-dev',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContactChatUnavailableError);
    expect(String(error)).not.toContain('secret start failure details');
  });

  it('sends validated conversation context to the single chat gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: '承知しました。',
      classification: 'genuine',
      readyForContact: false,
      sessionId: 'session-123',
      summary: '相談目的と現在の課題を整理しました。',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(postContactChat([{ role: 'user', content: '相談です' }], {
      mode: 'ambassador',
      locale: 'ja',
      intent: 'local-llm-poc',
      sessionId: 'session-123',
      source: 'cloudia',
    })).resolves.toMatchObject({
      sessionId: 'session-123',
      summary: '相談目的と現在の課題を整理しました。',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [{ role: 'user', content: '相談です' }],
      mode: 'ambassador',
      locale: 'ja',
      intent: 'local-llm-poc',
      sessionId: 'session-123',
      source: 'cloudia',
    });
  });

  it('preserves the readyForContact handoff signal in ambassador mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: '受付へ引き継げます。',
      classification: 'genuine',
      readyForContact: true,
      stage: 'ready',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(postContactChat([{ role: 'user', content: '相談内容を整理できました' }], {
      mode: 'ambassador',
      locale: 'ja',
      intent: null,
      source: 'cloudia',
    })).resolves.toMatchObject({
      readyForContact: true,
      stage: 'ready',
    });
  });

  it('preserves the Worker structuredLead fields without exposing them in the chat text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: '業種を確認しました。',
      classification: 'genuine',
      readyForContact: false,
      structuredLead: {
        purpose: '業務システム開発',
        industryRole: '製造 / 情シス',
        stage: 'exploring',
        discoverySource: '紹介',
        contactReason: '業務改善の相談',
      },
    }), { status: 200 })));

    await expect(postContactChat([{ role: 'user', content: '業務システム開発を検討しています' }], {
      mode: 'intake',
      locale: 'ja',
      intent: 'contract-dev',
    })).resolves.toMatchObject({
      structuredLead: {
        purpose: '業務システム開発',
        industryRole: '製造 / 情シス',
        stage: 'exploring',
        discoverySource: '紹介',
        contactReason: '業務改善の相談',
      },
    });
  });

  it('does not expose a server response body through errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'secret upstream failure details',
      { status: 503 },
    )));

    const error = await postContactChat([], {
      mode: 'intake',
      locale: 'en',
      intent: null,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContactChatUnavailableError);
    expect(String(error)).not.toContain('secret upstream failure details');
    expect(String(error)).not.toContain('503');
  });

  it('forwards AbortSignal to chat requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: '中断可能です。',
      classification: 'genuine',
      readyForContact: false,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await postContactChat([], { mode: 'intake', locale: 'ja', intent: null }, { signal: controller.signal });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('normalizes malformed classifications and empty replies by locale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: '',
      classification: 'unknown',
      readyForContact: 'false',
    }), { status: 200 })));

    await expect(postContactChat([], {
      mode: 'intake',
      locale: 'en',
      intent: null,
    })).resolves.toEqual({
      reply: 'Sorry, could you please tell me that again?',
      classification: 'genuine',
      readyForContact: false,
    });
  });

  it('normalizes untrusted context values at the network boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      reply: 'ok',
      classification: 'genuine',
      readyForContact: false,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactChat([], {
      mode: 'admin' as 'intake',
      locale: 'fr' as 'en',
      intent: 'not-an-intent' as 'local-llm-poc',
      source: 'cloudia',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      mode: 'intake',
      locale: 'en',
      intent: null,
      source: 'cloudia',
      messages: [],
    });
  });

  it('rejects non-object JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));

    await expect(postContactChat([], {
      mode: 'intake',
      locale: 'ja',
      intent: null,
    })).rejects.toBeInstanceOf(ContactChatUnavailableError);
  });

  it('trims and bounds the history sent to the gateway', () => {
    const history = Array.from({ length: 25 }, (_, index) => ({
      sender: index % 2 === 0 ? 'user' as const : 'ai' as const,
      text: `  ${index}-${'x'.repeat(2100)}  `,
    }));
    const messages = toApiMessages(history);

    expect(messages).toHaveLength(20);
    expect(messages[0].content.startsWith('5-')).toBe(true);
    expect(messages.every((message) => message.content.length <= 2000)).toBe(true);
  });

  it('keeps submit idempotency and session metadata in the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receiptId: 'receipt-1',
      status: 'queued',
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactSubmit({
      sessionId: 'session-123',
      idempotencyKey: 'idempotency-123',
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      intent: 'local-llm-poc',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      sessionId: 'session-123',
      idempotencyKey: 'idempotency-123',
      message: '[intent:local-llm-poc] 相談内容',
      summaryText: '',
    });
  });

  it('forwards structuredLead as non-PII submit metadata when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receiptId: 'receipt-2',
      status: 'queued',
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      structuredLead: { purpose: '業務システム開発', stage: 'exploring' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      structuredLead: { purpose: '業務システム開発', stage: 'exploring' },
    });
  });
});
