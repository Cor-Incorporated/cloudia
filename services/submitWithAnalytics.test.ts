import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from './analytics';
import { TEST_GA4_ID, createFakeWindow, dataLayerEntries, eventsNamed } from './analytics.testkit';
import { ContactChatUnavailableError, type SubmitPayload } from './contactChatClient';
import { submitContactInquiry } from './submitWithAnalytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Typed values the visitor entered. None of them may ever reach the analytics payload.
const payload: SubmitPayload = {
  sessionId: null,
  idempotencyKey: 'key-1',
  name: '山田 太郎',
  email: 'taro@example.com',
  company: 'Example Inc.',
  message: '見積もりの相談です',
  intent: 'grift-team-beta',
  source: 'cloudia',
  website: '',
};

const RECEIPT = 'COR-20261108-1A2B3C4D';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function startedTracker() {
  const win = createFakeWindow({ search: '?intent=grift-team-beta' });
  const analytics = createAnalytics(win, TEST_GA4_ID);
  analytics.start();
  return { win, analytics, successes: () => eventsNamed(win, 'contact_chat_submit_success') };
}

describe('submitContactInquiry', () => {
  it.each([400, 401, 403, 408, 413, 422, 429, 500, 502, 503])(
    'does not count a %i answer as a completion',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'failed' }, status)));
      const { analytics, successes } = startedTracker();

      await expect(submitContactInquiry(payload, {}, analytics)).rejects.toBeInstanceOf(ContactChatUnavailableError);
      expect(successes()).toHaveLength(0);
    },
  );

  it('does not count a network failure or a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { analytics, successes } = startedTracker();

    await expect(submitContactInquiry(payload, {}, analytics)).rejects.toBeInstanceOf(TypeError);
    expect(successes()).toHaveLength(0);
  });

  it('does not count a request the visitor aborted', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }));
    const { analytics, successes } = startedTracker();

    await expect(submitContactInquiry(payload, { signal: controller.signal }, analytics)).rejects.toMatchObject({ name: 'AbortError' });
    expect(successes()).toHaveLength(0);
  });

  it('does not count a 200 that is not a receipt: the honeypot answer, an HTML body, a malformed receipt', async () => {
    const bodies: Response[] = [
      jsonResponse({ ok: true }),
      new Response('<html>maintenance</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      jsonResponse({ ok: true, receiptId: 'not a receipt' }),
      jsonResponse({ ok: false, receiptId: RECEIPT }),
    ];
    for (const response of bodies) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      const { analytics, successes } = startedTracker();
      await submitContactInquiry(payload, {}, analytics).catch(() => undefined);
      expect(successes()).toHaveLength(0);
    }
  });

  it('counts the completion only after the server has answered', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => { answer = resolve; })));
    const { analytics, successes } = startedTracker();

    const pending = submitContactInquiry(payload, {}, analytics);
    await Promise.resolve();
    expect(successes()).toHaveLength(0); // request sent, no answer yet

    answer(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false }));
    const result = await pending;
    expect(result.receiptId).toBe(RECEIPT);
    expect(successes()).toEqual([{ intent: 'grift-team-beta' }]);
  });

  it('counts a failed attempt followed by an accepted retry exactly once', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'queue down' }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false }));
    vi.stubGlobal('fetch', fetchMock);
    const { analytics, successes } = startedTracker();

    await expect(submitContactInquiry(payload, {}, analytics)).rejects.toBeInstanceOf(ContactChatUnavailableError);
    expect(successes()).toHaveLength(0);
    await submitContactInquiry(payload, {}, analytics);
    expect(successes()).toHaveLength(1);
  });

  it('counts the same inquiry once when the Worker answers a repeated request with duplicate:true', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: true })));
    const { analytics, successes } = startedTracker();

    await submitContactInquiry(payload, {}, analytics);
    await submitContactInquiry(payload, {}, analytics);
    expect(successes()).toHaveLength(1);
  });

  it('never puts the typed values or the receipt number into the analytics payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false })));
    const { win, analytics } = startedTracker();

    await submitContactInquiry(payload, {}, analytics);
    const wire = JSON.stringify(dataLayerEntries(win));
    for (const typed of ['山田', 'taro', 'example.com', 'Example Inc.', '見積もり', RECEIPT, 'COR-2026', 'key-1']) {
      expect(wire).not.toContain(typed);
    }
  });

  it('still resolves with the Worker result when the tracker throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false })));
    const brokenTracker = {
      trackSubmitSuccess: () => {
        throw new Error('analytics is broken');
      },
    };

    await expect(submitContactInquiry(payload, {}, brokenTracker)).resolves.toMatchObject({ ok: true, receiptId: RECEIPT });
  });

  it('still returns the Worker result unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, receiptId: RECEIPT, status: 'queued', duplicate: false })));
    const { analytics } = startedTracker();
    const result = await submitContactInquiry(payload, {}, analytics);
    expect(result).toMatchObject({ ok: true, status: 200, receiptId: RECEIPT });
  });
});
