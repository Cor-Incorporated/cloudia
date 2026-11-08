import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAnalytics,
  isAcceptedSubmission,
  normalizeGa4Id,
  sanitizePageLocation,
  sanitizeReferrer,
  startAnalytics,
} from './analytics';
import type { SubmitResult } from './contactChatClient';
import {
  TEST_GA4_ID,
  createFakeWindow,
  dataLayerEntries,
  eventsNamed,
  type FakeWindowOptions,
} from './analytics.testkit';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('normalizeGa4Id', () => {
  it('accepts a measurement ID and trims surrounding whitespace', () => {
    expect(normalizeGa4Id('G-56XKQHYW4E')).toBe('G-56XKQHYW4E');
    expect(normalizeGa4Id('  G-56XKQHYW4E\n')).toBe('G-56XKQHYW4E');
  });

  it('rejects anything that could change the script URL', () => {
    for (const raw of [undefined, null, '', 'g-56xkqhyw4e', 'UA-123456-1', 'G-', 'G-12&x=1', 'G-12"><script>', 'G-12\nG-34', 'G-12 G-34']) {
      expect(normalizeGa4Id(raw)).toBe('');
    }
  });
});

describe('sanitizePageLocation', () => {
  it('keeps only allow-listed values and drops every other query parameter and the hash', () => {
    const url = sanitizePageLocation(
      'https://cor-jp.com',
      '/contact/chat/',
      '?intent=grift-team-beta&source=grift-lp-hero&utm_source=grift&utm_medium=cta&email=taro%40example.com&q=secret&token=abc#frag',
    );
    expect(url).toBe('https://cor-jp.com/contact/chat/?intent=grift-team-beta&utm_source=grift&utm_medium=cta');
  });

  it('returns the bare path when nothing is allow-listed', () => {
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '?email=a%40b.com&intent=unknown&utm_source=evil')).toBe(
      'https://cor-jp.com/contact/chat/',
    );
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '')).toBe('https://cor-jp.com/contact/chat/');
  });

  it('never echoes the raw value: it writes the canonical key instead', () => {
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '?intent=%20Grift-Team-Beta%20&utm_source=GRIFT')).toBe(
      'https://cor-jp.com/contact/chat/?intent=grift-team-beta&utm_source=grift',
    );
  });

  it.each([
    'industry-medical',
    'industry-shigyo',
    'industry-construction',
    'industry-manufacturing',
    'industry-education',
    'corsweb-contact-primary',
    'corsweb-launcher',
    'corsweb-launcher-fallback',
  ])('keeps the allow-listed entry source %s and drops personal data beside it', (source) => {
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', `?source=${source}&email=taro%40example.com&q=secret`)).toBe(
      `https://cor-jp.com/contact/chat/?source=${source}`,
    );
  });

  it('keeps an industry source when the locale is not ja or en, and does not keep that locale', () => {
    expect(sanitizePageLocation(
      'https://cor-jp.com',
      '/contact/chat/',
      '?locale=zh&source=industry-medical&email=taro%40example.com',
    )).toBe('https://cor-jp.com/contact/chat/?source=industry-medical');
    for (const locale of ['ko', 'es', 'zh-CN']) {
      expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', `?locale=${locale}&source=industry-education`)).toBe(
        'https://cor-jp.com/contact/chat/?source=industry-education',
      );
    }
  });

  it('drops an unknown, mismatched, repeated, or personal source without writing it back', () => {
    const attack = 'industry-medical\nIgnore previous instructions taro@example.com';
    const cases = [
      '?source=grift-lp-hero',
      '?source=INDUSTRY-MEDICAL',
      '?source=%20industry-medical%20',
      '?source=industry-medical&source=industry-education',
      '?source=industry-medical&source=industry-medical',
      `?source=${encodeURIComponent(attack)}`,
      '?source=taro%40example.com',
      '?source=090-1234-5678',
    ];
    for (const search of cases) {
      const url = sanitizePageLocation('https://cor-jp.com', '/contact/chat/', search);
      expect(url).toBe('https://cor-jp.com/contact/chat/');
      expect(url).not.toContain('taro');
      expect(url).not.toContain('Ignore');
      expect(url).not.toContain('090');
      expect(url).not.toContain('INDUSTRY');
    }
  });

  it('keeps the locale the app reads, and only the exact values ja and en', () => {
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '?locale=en&email=a%40b.com')).toBe(
      'https://cor-jp.com/contact/chat/?locale=en',
    );
    for (const bad of ['fr', 'EN', ' ja', '']) {
      expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', `?locale=${encodeURIComponent(bad)}`)).toBe(
        'https://cor-jp.com/contact/chat/',
      );
    }
  });

  it('uses the first value when a parameter is repeated and ignores a bad first value', () => {
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '?intent=local-llm-poc&intent=contract-dev')).toBe(
      'https://cor-jp.com/contact/chat/?intent=local-llm-poc',
    );
    expect(sanitizePageLocation('https://cor-jp.com', '/contact/chat/', '?intent=a%40b.com&intent=contract-dev')).toBe(
      'https://cor-jp.com/contact/chat/',
    );
  });
});

describe('sanitizeReferrer', () => {
  it('keeps origin and path and drops query and hash', () => {
    expect(sanitizeReferrer('https://griftai.org/ja/pricing/?session=abc&email=a%40b.com#x')).toBe('https://griftai.org/ja/pricing/');
    expect(sanitizeReferrer('https://griftai.org/')).toBe('https://griftai.org/');
  });

  it('returns an empty string for nothing, garbage, or a non-web scheme', () => {
    for (const raw of ['', 'not a url', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com/']) {
      expect(sanitizeReferrer(raw)).toBe('');
    }
  });
});

describe('createAnalytics: when it stays silent', () => {
  const cases: [string, FakeWindowOptions, string | undefined][] = [
    ['the measurement ID is unset', {}, undefined],
    ['the measurement ID is malformed', {}, 'G-12&x=1'],
    ['it runs on localhost', { hostname: 'localhost' }, TEST_GA4_ID],
    ['it runs on a Pages preview host', { hostname: '6d1529fa.cloudia-contact.pages.dev' }, TEST_GA4_ID],
    ['it runs on www.cor-jp.com', { hostname: 'www.cor-jp.com' }, TEST_GA4_ID],
    ['it is the launcher iframe (?embed=1)', { search: '?embed=1&intent=grift-team-beta' }, TEST_GA4_ID],
    ['it is framed by another window', { framed: true }, TEST_GA4_ID],
    ['the parent window cannot be read', { topThrows: true }, TEST_GA4_ID],
    ['it is the ambassador demo (?mode=ambassador)', { search: '?mode=ambassador' }, TEST_GA4_ID],
    ['it is the ambassador demo path', { pathname: '/contact/chat/ambassador/' }, TEST_GA4_ID],
  ];

  it.each(cases)('loads nothing and sends nothing when %s', (_name, options, id) => {
    const win = createFakeWindow(options);
    const analytics = createAnalytics(win, id);
    analytics.start();
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    expect(win.scripts).toHaveLength(0);
    expect(win.dataLayer).toBeUndefined();
    expect(win.gtag).toBeUndefined();
  });

  it('does nothing when there is no window at all (SSR, tests)', () => {
    const analytics = createAnalytics(undefined, TEST_GA4_ID);
    expect(() => {
      analytics.start();
      analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', null);
    }).not.toThrow();
  });
});

describe('createAnalytics: arrival', () => {
  it('loads gtag.js once and sends the page view plus one arrival event with allow-listed values only', () => {
    const win = createFakeWindow({
      search: '?intent=grift-team-beta&source=grift-lp-hero&utm_source=grift&utm_medium=cta&email=taro%40example.com&q=secret#frag',
      referrer: 'https://griftai.org/ja/pricing/?session=abc#x',
    });
    createAnalytics(win, TEST_GA4_ID).start();

    expect(win.scripts.map((script) => script.src)).toEqual([`https://www.googletagmanager.com/gtag/js?id=${TEST_GA4_ID}`]);
    expect(win.scripts[0].async).toBe(true);
    expect(dataLayerEntries(win)).toEqual([
      ['js', expect.any(Date)],
      [
        'config',
        TEST_GA4_ID,
        {
          page_location: 'https://cor-jp.com/contact/chat/?intent=grift-team-beta&utm_source=grift&utm_medium=cta',
          page_referrer: 'https://griftai.org/ja/pricing/',
        },
      ],
      ['event', 'contact_chat_view', { intent: 'grift-team-beta', utm_source: 'grift', utm_medium: 'cta' }],
    ]);

    const wire = JSON.stringify(dataLayerEntries(win));
    for (const leaked of ['taro', 'example.com', 'secret', 'session=abc', 'frag', 'grift-lp-hero', 'email=']) {
      expect(wire).not.toContain(leaked);
    }
  });

  it.each([
    'industry-medical',
    'industry-shigyo',
    'industry-construction',
    'industry-manufacturing',
    'industry-education',
  ])('sends %s as entry_source and not as free text', (source) => {
    const win = createFakeWindow({
      search: `?source=${source}&intent=confidential-ai-assessment&email=taro%40example.com&q=${encodeURIComponent('patient Yamada')}`,
    });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(eventsNamed(win, 'contact_chat_view')).toEqual([
      { intent: 'confidential-ai-assessment', entry_source: source },
    ]);
    expect(win.location.search).toBe(`?intent=confidential-ai-assessment&source=${source}`);
    const wire = JSON.stringify(dataLayerEntries(win));
    expect(wire).not.toContain('taro');
    expect(wire).not.toContain('Yamada');
    expect(wire).not.toContain('patient');
  });

  it('does not send a repeated or personal source, and still sends a valid intent', () => {
    const win = createFakeWindow({
      search: '?source=industry-medical&source=taro%40example.com&intent=local-llm-poc',
    });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(eventsNamed(win, 'contact_chat_view')).toEqual([{ intent: 'local-llm-poc' }]);
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('taro');
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('industry-medical');
  });

  it('sends an empty parameter set and no referrer override when the visitor arrives without a query', () => {
    const win = createFakeWindow();
    createAnalytics(win, TEST_GA4_ID).start();
    expect(dataLayerEntries(win)[1]).toEqual(['config', TEST_GA4_ID, { page_location: 'https://cor-jp.com/contact/chat/' }]);
    expect(eventsNamed(win, 'contact_chat_view')).toEqual([{}]);
  });

  it('sends the arrival event once when start() runs twice (React StrictMode or a double render)', () => {
    const win = createFakeWindow({ search: '?intent=local-llm-poc' });
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.start();
    expect(eventsNamed(win, 'contact_chat_view')).toHaveLength(1);
    expect(win.scripts).toHaveLength(1);
    expect(dataLayerEntries(win).filter((entry) => entry[0] === 'config')).toHaveLength(1);
  });

  it('sends the arrival event once even when a second copy of the module starts on the same page', () => {
    const win = createFakeWindow({ search: '?intent=local-llm-poc' });
    createAnalytics(win, TEST_GA4_ID).start();
    createAnalytics(win, TEST_GA4_ID).start();
    expect(eventsNamed(win, 'contact_chat_view')).toHaveLength(1);
    expect(win.scripts).toHaveLength(1);
    expect(dataLayerEntries(win).filter((entry) => entry[0] === 'config')).toHaveLength(1);
  });

  it('counts a new page view as a new arrival (a fresh window starts again)', () => {
    const first = createFakeWindow();
    const second = createFakeWindow();
    createAnalytics(first, TEST_GA4_ID).start();
    createAnalytics(second, TEST_GA4_ID).start();
    expect(eventsNamed(first, 'contact_chat_view')).toHaveLength(1);
    expect(eventsNamed(second, 'contact_chat_view')).toHaveLength(1);
  });
});

// Measured 2026-11-08 with the live property's settings: gtag.js ignores the page_location
// given to `config` and builds `dl` (and the history-change page_view) from the real URL.
// So the real URL itself has to be clean before gtag.js loads.
describe('createAnalytics: the real URL', () => {
  it('rewrites the visible URL to the allow-listed form before gtag.js loads', () => {
    const win = createFakeWindow({
      search: '?email=taro%40example.com&ref=xyz&utm_source=grift&utm_medium=cta&intent=grift-team-beta&source=grift-lp-hero',
      hash: '#note',
    });
    createAnalytics(win, TEST_GA4_ID).start();

    expect(win.replaceStateCalls).toEqual(['/contact/chat/?intent=grift-team-beta&utm_source=grift&utm_medium=cta']);
    expect(win.location.search).toBe('?intent=grift-team-beta&utm_source=grift&utm_medium=cta');
    expect(win.location.hash).toBe('');
    expect(win.order).toEqual(['replaceState', 'script']); // the URL is clean before the script is added
  });

  it('drops a hash even when the query is already clean (form events report the whole URL)', () => {
    const win = createFakeWindow({ search: '?intent=local-llm-poc', hash: '#note' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.replaceStateCalls).toEqual(['/contact/chat/?intent=local-llm-poc']);
    expect(win.location.hash).toBe('');
  });

  it('replaces document.referrer with its origin and path before gtag.js reads it', () => {
    const win = createFakeWindow({ referrer: 'https://cor-jp.com/contact/?token=abc&name=taro#x' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.document.referrer).toBe('https://cor-jp.com/contact/');
    expect(dataLayerEntries(win)[1]).toEqual(['config', TEST_GA4_ID, expect.objectContaining({ page_referrer: 'https://cor-jp.com/contact/' })]);
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('token');
  });

  it('leaves a referrer that is already origin-only, and an empty one, alone', () => {
    const origin = createFakeWindow({ referrer: 'https://griftai.org/' });
    createAnalytics(origin, TEST_GA4_ID).start();
    expect(origin.document.referrer).toBe('https://griftai.org/');
    const none = createFakeWindow();
    createAnalytics(none, TEST_GA4_ID).start();
    expect(none.document.referrer).toBe('');
  });

  it('fails closed when the referrer cannot be replaced', () => {
    const win = createFakeWindow({ referrer: 'https://cor-jp.com/contact/?token=abc', referrerLocked: true });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.scripts).toHaveLength(0);
    expect(win.dataLayer).toBeUndefined();
  });

  it('keeps the locale in the URL but never in the event parameters', () => {
    const win = createFakeWindow({ search: '?locale=en&intent=local-llm-poc&ref=xyz', hash: '#top' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.location.search).toBe('?intent=local-llm-poc&locale=en');
    expect(eventsNamed(win, 'contact_chat_view')).toEqual([{ intent: 'local-llm-poc' }]);
  });

  it('keeps the locale the app reads while it cleans the rest', () => {
    const win = createFakeWindow({ search: '?locale=en&ref=xyz' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.replaceStateCalls).toEqual(['/contact/chat/?locale=en']);
  });

  it('leaves a URL that is already clean untouched', () => {
    const win = createFakeWindow({ search: '?intent=local-llm-poc&utm_source=grift' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.replaceStateCalls).toEqual([]);
    expect(win.order).toEqual(['script']);
  });

  it('does not touch the URL when it stays silent', () => {
    const win = createFakeWindow({ hostname: 'localhost', search: '?ref=xyz' });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.replaceStateCalls).toEqual([]);
    expect(win.location.search).toBe('?ref=xyz');
  });

  it('fails closed: if the URL cannot be rewritten, gtag.js is not loaded', () => {
    const win = createFakeWindow({ search: '?ref=xyz', replaceStateThrows: true });
    createAnalytics(win, TEST_GA4_ID).start();
    expect(win.scripts).toHaveLength(0);
    expect(win.dataLayer).toBeUndefined();
    expect(win.gtag).toBeUndefined();
  });

  it('keeps the URL the app writes later on the allow-list (picking an intent only adds `intent`)', () => {
    const win = createFakeWindow({ search: '?ref=xyz&utm_source=grift' });
    createAnalytics(win, TEST_GA4_ID).start();

    // What App.tsx does on an intent pick: start from the current URL and set `intent`.
    const next = new URL(`${win.location.origin}${win.location.pathname}${win.location.search}`);
    next.searchParams.set('intent', 'contract-dev');

    // Nothing the cleaner would drop is left in the URL (order does not matter).
    const sanitized = new URL(sanitizePageLocation(win.location.origin, next.pathname, next.search));
    const sortedEntries = (params: URLSearchParams) => [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    expect(sortedEntries(sanitized.searchParams)).toEqual(sortedEntries(next.searchParams));
    expect(sortedEntries(next.searchParams)).toEqual([['intent', 'contract-dev'], ['utm_source', 'grift']]);
  });
});

describe('createAnalytics: submit success', () => {
  it('sends one success event carrying only the selected intent', () => {
    const win = createFakeWindow();
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    expect(eventsNamed(win, 'contact_chat_submit_success')).toEqual([{ intent: 'grift-team-beta' }]);
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('COR-20261108');
  });

  it('sends the entry source captured at arrival, not a source typed later', () => {
    const win = createFakeWindow({ search: '?source=industry-construction&intent=contract-dev&email=taro%40example.com' });
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    win.location.search = '?source=taro%40example.com&intent=contract-dev';
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'contract-dev');
    expect(eventsNamed(win, 'contact_chat_submit_success')).toEqual([
      { intent: 'contract-dev', entry_source: 'industry-construction' },
    ]);
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('taro');
  });

  it('sends an empty parameter set when no intent was selected', () => {
    const win = createFakeWindow();
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', null);
    expect(eventsNamed(win, 'contact_chat_submit_success')).toEqual([{}]);
  });

  it('does not count the same receipt twice (retry, double click, duplicate answer)', () => {
    const win = createFakeWindow();
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    expect(eventsNamed(win, 'contact_chat_submit_success')).toHaveLength(1);
  });

  it('counts a second, different inquiry from the same page view', () => {
    const win = createFakeWindow();
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    analytics.trackSubmitSuccess('COR-20261108-9Z8Y7X6W', 'contract-dev');
    expect(eventsNamed(win, 'contact_chat_submit_success')).toEqual([{ intent: 'grift-team-beta' }, { intent: 'contract-dev' }]);
  });

  it('sends nothing before the tracker has started', () => {
    const win = createFakeWindow();
    createAnalytics(win, TEST_GA4_ID).trackSubmitSuccess('COR-20261108-1A2B3C4D', 'grift-team-beta');
    expect(win.dataLayer).toBeUndefined();
  });

  it('ignores a receipt that is not in the Worker format', () => {
    const win = createFakeWindow();
    const analytics = createAnalytics(win, TEST_GA4_ID);
    analytics.start();
    analytics.trackSubmitSuccess('taro@example.com', 'grift-team-beta');
    analytics.trackSubmitSuccess('', 'grift-team-beta');
    expect(eventsNamed(win, 'contact_chat_submit_success')).toHaveLength(0);
    expect(JSON.stringify(dataLayerEntries(win))).not.toContain('taro');
  });
});

describe('isAcceptedSubmission', () => {
  const accepted: SubmitResult = {
    ok: true,
    status: 200,
    body: { ok: true, receiptId: 'COR-20261108-1A2B3C4D', status: 'queued', duplicate: false },
    receiptId: 'COR-20261108-1A2B3C4D',
  };

  it('accepts the Worker answer that carries a receipt', () => {
    expect(isAcceptedSubmission(accepted)).toBe(true);
    expect(isAcceptedSubmission({ ...accepted, body: { ...(accepted.body as object), duplicate: true } })).toBe(true);
  });

  it('rejects the honeypot answer (200 {ok:true} without a receipt)', () => {
    expect(isAcceptedSubmission({ ok: true, status: 200, body: { ok: true } })).toBe(false);
  });

  it('rejects the local mock answer, an unreadable body and a non-success body', () => {
    expect(isAcceptedSubmission({ ok: true, status: 200, body: { ok: true, mock: true } })).toBe(false);
    expect(isAcceptedSubmission({ ok: true, status: 200, body: undefined })).toBe(false);
    expect(isAcceptedSubmission({ ...accepted, body: { ok: false, receiptId: 'COR-20261108-1A2B3C4D' } })).toBe(false);
    expect(isAcceptedSubmission({ ...accepted, ok: false })).toBe(false);
    expect(isAcceptedSubmission({ ...accepted, status: 500 })).toBe(false);
  });
});

describe('startAnalytics', () => {
  it('is a harmless no-op where there is no window', () => {
    vi.stubEnv('VITE_GA4_ID', TEST_GA4_ID);
    expect(() => startAnalytics()).not.toThrow();
  });
});
