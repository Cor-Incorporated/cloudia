import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContactChatUnavailableError,
  getFallbackContactUrl,
  normalizeFallbackContactUrl,
  postContactChat,
  postContactChatStart,
  postContactSubmit,
  toApiMessages,
} from './contactChatClient';

const FUTURE_HANDOFF_EXPIRY = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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

  it('sends a bounded Turnstile token only in the submit verification field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      turnstileToken: '  ephemeral-turnstile-token  ',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.turnstileToken).toBe('ephemeral-turnstile-token');
    expect(body.message).not.toContain('ephemeral-turnstile-token');
    expect(body.summaryText).not.toContain('ephemeral-turnstile-token');
  });

  it.each(['', 'x'.repeat(2049)])('omits an invalid Turnstile token', async (turnstileToken) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      turnstileToken,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('turnstileToken');
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

  it('sends locale, normalized source, and explicit Grift consent for contract-dev', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receiptId: 'receipt-grift',
      status: 'queued',
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/opaque-token',
        expiresAt: FUTURE_HANDOFF_EXPIRY,
      },
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '確認した補足',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        structuredLead: { purpose: '業務システム開発' },
        text: '相談者が確認・編集した要約',
      },
      locale: 'ja',
      intent: 'contract-dev',
      source: ' Header-AI-Dev ',
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      locale: 'ja',
      source: 'header-ai-dev',
      intent: 'contract-dev',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        text: '相談者が確認・編集した要約',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      status: 202,
      receiptId: 'receipt-grift',
      deliveryStatus: 'queued',
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/opaque-token',
        expiresAt: FUTURE_HANDOFF_EXPIRY,
      },
    });
  });

  it.each([
    'contract-dev',
    'grift-team-beta',
    'grift-paid-trial',
    'estimate-audit',
  ] as const)('keeps original %s intent/source and sends confirmed Grift consent', async (intent) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/eligible-token',
        expiresAt: FUTURE_HANDOFF_EXPIRY,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: 'Confirmed notes',
      locale: 'en',
      intent,
      source: 'grift-lp',
      summaryText: {
        version: 1,
        locale: 'en',
        intent,
        classification: 'genuine',
        readyForContact: true,
        text: 'Confirmed summary',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.intent).toBe(intent);
    expect(body.source).toBe('grift-lp');
    expect(body.summaryText.intent).toBe(intent);
    expect(body.handoffConsent).toMatchObject({ accepted: true, summaryConfirmed: true });
    expect(result.handoff).toMatchObject({ status: 'ready' });
  });

  it.each([
    'confidential-ai-assessment',
    'local-llm-poc',
    'press-speaking-other',
  ] as const)('never sends Grift consent or accepts a handoff for unrelated %s', async (intent) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receiptId: 'receipt-email',
      status: 'sent',
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/must-not-open',
        expiresAt: FUTURE_HANDOFF_EXPIRY,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      locale: 'en',
      intent,
      source: 'cloudia',
      summaryText: {
        version: 1,
        locale: 'en',
        intent,
        classification: 'genuine',
        readyForContact: true,
        text: 'Confirmed summary',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('handoffConsent');
    expect(result).toMatchObject({
      receiptId: 'receipt-email',
      deliveryStatus: 'sent',
    });
    expect(result.handoff).toBeUndefined();
  });

  it('drops Grift consent unless the exact summary envelope was explicitly confirmed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/must-not-open',
        expiresAt: FUTURE_HANDOFF_EXPIRY,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      locale: 'ja',
      intent: 'contract-dev',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        text: '確認済み要約',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: false,
      } as unknown as Parameters<typeof postContactSubmit>[0]['handoffConsent'],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('handoffConsent');
    expect(result.handoff).toBeUndefined();
  });

  it('whitelists the confirmed summary envelope and never serializes a raw transcript field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const rawTranscript = 'User: private raw turn\nCloudia: private raw reply';
    const exactConfirmedSummary = '  The project purpose and timing were confirmed.  ';

    await postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '確認した補足',
      locale: 'en',
      intent: 'contract-dev',
      classification: 'genuine',
      structuredLead: {
        purpose: 'Build a workflow system',
        rawTranscript,
      },
      summaryText: {
        version: 1,
        locale: 'en',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        text: exactConfirmedSummary,
        transcript: rawTranscript,
      },
      messages: [{ role: 'user', content: rawTranscript }],
    } as Parameters<typeof postContactSubmit>[0] & Record<string, unknown>);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).not.toHaveProperty('messages');
    expect(body.summaryText).not.toHaveProperty('transcript');
    expect(body.summaryText.text).toBe(exactConfirmedSummary);
    expect(body.structuredLead).not.toHaveProperty('rawTranscript');
    expect(JSON.stringify(body)).not.toContain(rawTranscript);
  });

  it('parses Grift fallback without turning a successful inquiry into an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receiptId: 'receipt-fallback',
      status: 'queued',
      handoff: { status: 'fallback' },
    }), { status: 202 })));

    await expect(postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      locale: 'ja',
      intent: 'contract-dev',
      source: 'cloudia',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        text: '確認済み要約',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    })).resolves.toMatchObject({
      ok: true,
      receiptId: 'receipt-fallback',
      handoff: { status: 'fallback' },
    });
  });

  it('keeps legacy submit responses compatible and rejects unsafe handoff URLs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        handoff: {
          status: 'ready',
          url: 'https://evil.example/chat/portal/token',
          expiresAt: FUTURE_HANDOFF_EXPIRY,
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        handoff: { status: 'ready', url: 'https://app.griftai.org/chat/portal/token' },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = { name: 'Test User', email: 'test@example.com', message: '相談内容' };
    const griftPayload = {
      ...payload,
      locale: 'ja' as const,
      intent: 'contract-dev' as const,
      summaryText: {
        version: 1 as const,
        locale: 'ja' as const,
        intent: 'contract-dev' as const,
        classification: 'genuine' as const,
        readyForContact: true,
        text: '確認済み要約',
      },
      handoffConsent: {
        accepted: true as const,
        version: 'cloudia-grift-v1' as const,
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true as const,
      },
    };

    await expect(postContactSubmit(payload)).resolves.toMatchObject({ ok: true, status: 200 });
    await expect(postContactSubmit(griftPayload)).resolves.toMatchObject({
      ok: true,
      handoff: { status: 'fallback' },
    });
    await expect(postContactSubmit(griftPayload)).resolves.toMatchObject({
      ok: true,
      handoff: { status: 'fallback' },
    });
  });

  it('downgrades an expired handoff URL to email fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      handoff: {
        status: 'ready',
        url: 'https://app.griftai.org/chat/portal/expired-token',
        expiresAt: '2000-01-01T00:00:00.000Z',
      },
    }), { status: 200 })));

    await expect(postContactSubmit({
      name: 'Test User',
      email: 'test@example.com',
      message: '相談内容',
      locale: 'ja',
      intent: 'contract-dev',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        text: '確認済み要約',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true,
      },
    })).resolves.toMatchObject({ handoff: { status: 'fallback' } });
  });

  it('uses an email fallback instead of a URL that loops back into Cloudia', () => {
    expect(getFallbackContactUrl()).toBe('mailto:cloudia@cor-jp.com');
    expect(normalizeFallbackContactUrl('https://cor-jp.com/contact/chat/?intent=contract-dev'))
      .toBe('mailto:cloudia@cor-jp.com');
    expect(normalizeFallbackContactUrl('https://www.cor-jp.com/contact/%63hat/'))
      .toBe('mailto:cloudia@cor-jp.com');
    expect(normalizeFallbackContactUrl('http://support.example.com/contact'))
      .toBe('mailto:cloudia@cor-jp.com');
    expect(normalizeFallbackContactUrl('mailto:attacker@example.com?body=%0AInjected'))
      .toBe('mailto:cloudia@cor-jp.com');
    expect(normalizeFallbackContactUrl('https://support.example.com/contact'))
      .toBe('https://support.example.com/contact');
  });
});
