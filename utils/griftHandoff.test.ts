import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  announceCloudiaReady,
  CLOUDIA_READY_MESSAGE,
  GRIFT_MAX_PORTAL_TTL_MS,
  GRIFT_PRODUCTION_PUBLIC_ORIGIN,
  openGriftHandoff,
  parseAllowedGriftHandoffUrl,
  parseValidGriftHandoffExpiry,
  resolveAllowedEmbedParentOrigins,
  resolveAllowedGriftPublicOrigins,
  resolveEmbedParentOrigin,
  type GriftHandoffBrowser,
} from './griftHandoff';

const EXCHANGE_CODE = 'Ma_XZhn01UsAfQRYmYxXD9KZVzK0bKQCSv0nZFbofUM';
const PORTAL_URL = `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`;
const PREVIEW_ORIGIN = 'https://grift-preview.example.run.app';
const PREVIEW_PORTAL_URL = `${PREVIEW_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE}`;
const FIREBASE_PREVIEW_PARENT_ORIGIN = 'https://cor-jp-main--preview-abc123.web.app';

function futureExpiry(offsetMs = 4 * 60 * 1000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function topLevelBrowser(origin = 'https://cor-jp.com'): GriftHandoffBrowser {
  const browser = {
    location: { origin, assign: vi.fn() },
    document: { referrer: '' },
    postMessage: vi.fn(),
    parent: undefined,
  } as unknown as GriftHandoffBrowser;
  browser.parent = browser;
  return browser;
}

function framedBrowser(referrer: string, childOrigin = 'https://cloudia.pages.dev'): GriftHandoffBrowser {
  return {
    location: { origin: childOrigin, assign: vi.fn() },
    document: { referrer },
    postMessage: vi.fn(),
    parent: { postMessage: vi.fn() },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function malformedPortalUrls(): string[] {
  const shortCode = EXCHANGE_CODE.slice(0, 42);
  const nonCanonical32ByteCode = `${EXCHANGE_CODE.slice(0, 42)}B`;
  return [
    `http://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org:443/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org:444/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://user:password@app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://user%3Apassword@app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org.evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal/${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal/#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/other#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/%70ortal#exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal?next=https://evil.example#exchange_code=${EXCHANGE_CODE}`,
    'https://app.griftai.org/chat/portal',
    'https://app.griftai.org/chat/portal#exchange_code=',
    `https://app.griftai.org/chat/portal#Exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal#exchange%5Fcode=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal#unknown=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}&next=1`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}&exchange_code=${EXCHANGE_CODE}`,
    `https://app.griftai.org/chat/portal#exchange_code=${shortCode}`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}A`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}.`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}~`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}+`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}/`,
    `https://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}=`,
    `https://app.griftai.org/chat/portal#exchange_code=%4Da_XZhn01UsAfQRYmYxXD9KZVzK0bKQCSv0nZFbofUM`,
    `https://app.griftai.org/chat/portal#exchange_code=${nonCanonical32ByteCode}`,
    ` ${PORTAL_URL}`,
    `${PORTAL_URL} `,
  ];
}

describe('Grift handoff navigation', () => {
  it('announces application readiness only to the exact allowlisted embed parent', () => {
    const browser = framedBrowser(
      'https://cor-jp.com/contact/?source=corsweb-launcher',
      'https://cor-jp.com',
    );

    expect(announceCloudiaReady(browser)).toBe(true);
    expect(browser.parent.postMessage).toHaveBeenCalledExactlyOnceWith(
      CLOUDIA_READY_MESSAGE,
      'https://cor-jp.com',
    );

    const previewBrowser = framedBrowser(
      `${FIREBASE_PREVIEW_PARENT_ORIGIN}/contact/chat/?embed=1`,
      'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    );
    expect(announceCloudiaReady(previewBrowser, FIREBASE_PREVIEW_PARENT_ORIGIN)).toBe(true);
    expect(previewBrowser.parent.postMessage).toHaveBeenCalledExactlyOnceWith(
      CLOUDIA_READY_MESSAGE,
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    );
  });

  it('does not announce readiness top-level or to an untrusted or malformed parent', () => {
    const topLevel = topLevelBrowser();
    expect(announceCloudiaReady(topLevel)).toBe(false);
    expect(topLevel.postMessage).not.toHaveBeenCalled();

    for (const referrer of [
      'https://evil.example/contact/',
      'https://cor-jp.com.evil.example/contact/',
      'https://user:password@cor-jp.com/contact/',
      'https://cor-jp.com:443/contact/',
      'HTTPS://cor-jp.com/contact/',
      '',
    ]) {
      const browser = framedBrowser(referrer, 'https://cor-jp.com');
      expect(announceCloudiaReady(browser), referrer).toBe(false);
      expect(browser.parent.postMessage).not.toHaveBeenCalled();
    }
  });

  it('allows only the exact fragment exchange URL and returns it unchanged', () => {
    expect(parseAllowedGriftHandoffUrl(PORTAL_URL)).toBe(PORTAL_URL);

    for (const value of malformedPortalUrls()) {
      expect(parseAllowedGriftHandoffUrl(value), value).toBeNull();
    }
  });

  it('uses only explicitly configured exact HTTPS Preview origins', () => {
    const configured = [
      PREVIEW_ORIGIN,
      'https://grift-staging.example.run.app',
      PREVIEW_ORIGIN,
    ].join(',');
    const origins = resolveAllowedGriftPublicOrigins(configured);

    expect([...origins]).toEqual([
      PREVIEW_ORIGIN,
      'https://grift-staging.example.run.app',
    ]);
    expect(parseAllowedGriftHandoffUrl(PREVIEW_PORTAL_URL, configured)).toBe(PREVIEW_PORTAL_URL);
    expect(parseAllowedGriftHandoffUrl(PORTAL_URL, configured)).toBeNull();
    expect(parseAllowedGriftHandoffUrl(
      `https://unlisted.example.run.app/chat/portal#exchange_code=${EXCHANGE_CODE}`,
      configured,
    )).toBeNull();
  });

  it.each([
    '',
    `${PREVIEW_ORIGIN},`,
    `,${PREVIEW_ORIGIN}`,
    `${PREVIEW_ORIGIN},https://*.example.run.app`,
    `${PREVIEW_ORIGIN},http://insecure.example.run.app`,
    `${PREVIEW_ORIGIN},https://user:password@example.run.app`,
    `${PREVIEW_ORIGIN},https://example.run.app:443`,
    `${PREVIEW_ORIGIN},https://example.run.app:444`,
    `${PREVIEW_ORIGIN},https://example.run.app/path`,
    `${PREVIEW_ORIGIN},not-a-url`,
  ])('fails the whole runtime allowlist closed for empty or polluted config: %s', (configured) => {
    expect(resolveAllowedGriftPublicOrigins(configured)).toEqual(new Set());
    expect(parseAllowedGriftHandoffUrl(PREVIEW_PORTAL_URL, configured)).toBeNull();
  });

  it('uses the build-provided production origin without an implicit runtime fallback', () => {
    expect([...resolveAllowedGriftPublicOrigins()]).toEqual([GRIFT_PRODUCTION_PUBLIC_ORIGIN]);
    expect([...resolveAllowedGriftPublicOrigins(GRIFT_PRODUCTION_PUBLIC_ORIGIN)])
      .toEqual([GRIFT_PRODUCTION_PUBLIC_ORIGIN]);
    expect(resolveAllowedGriftPublicOrigins('')).toEqual(new Set());
    expect(parseAllowedGriftHandoffUrl(PREVIEW_PORTAL_URL, '')).toBeNull();
  });

  it('passes the unchanged fragment URL only to a top-level standalone visitor', () => {
    const browser = topLevelBrowser();
    const expiresAt = futureExpiry();

    expect(openGriftHandoff(PORTAL_URL, false, browser, expiresAt)).toBe('navigated');
    expect(browser.location.assign).toHaveBeenCalledWith(PORTAL_URL);

    expect(openGriftHandoff(PORTAL_URL, true, browser, expiresAt)).toBe('navigated');
  });

  it('passes the unchanged fragment URL to an allowlisted embed parent', () => {
    const browser = framedBrowser('https://www.cor-jp.com/contact/?intent=contract-dev');
    const expiresAt = futureExpiry();

    expect(openGriftHandoff(PORTAL_URL, true, browser, expiresAt)).toBe('messaged');
    expect(browser.parent.postMessage).toHaveBeenCalledWith({
      type: 'cloudia:grift-handoff-ready',
      url: PORTAL_URL,
      expiresAt,
    }, 'https://www.cor-jp.com');
    expect(browser.location.assign).not.toHaveBeenCalled();
  });

  it('adds an exact configured Firebase Preview parent without weakening production parents', () => {
    expect([...resolveAllowedEmbedParentOrigins(FIREBASE_PREVIEW_PARENT_ORIGIN)]).toEqual([
      'https://cor-jp.com',
      'https://www.cor-jp.com',
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    ]);
    expect(resolveEmbedParentOrigin(
      `${FIREBASE_PREVIEW_PARENT_ORIGIN}/contact/?intent=estimate-audit`,
      'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    )).toBe(FIREBASE_PREVIEW_PARENT_ORIGIN);
    expect(resolveEmbedParentOrigin(
      'https://www.cor-jp.com/contact/',
      'https://cloudia-contact.pages.dev',
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    )).toBe('https://www.cor-jp.com');
  });

  it('keeps the default environment allowlist limited to production parents when unset', () => {
    expect([...resolveAllowedEmbedParentOrigins()]).toEqual([
      'https://cor-jp.com',
      'https://www.cor-jp.com',
    ]);
  });

  it('posts only to the exact configured Firebase Preview origin derived from referrer', () => {
    const browser = framedBrowser(
      `${FIREBASE_PREVIEW_PARENT_ORIGIN}/contact/chat/?embed=1`,
      'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    );
    const expiresAt = futureExpiry();

    expect(openGriftHandoff(
      PORTAL_URL,
      true,
      browser,
      expiresAt,
      GRIFT_PRODUCTION_PUBLIC_ORIGIN,
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    )).toBe('messaged');
    expect(browser.parent.postMessage).toHaveBeenCalledWith({
      type: 'cloudia:grift-handoff-ready',
      url: PORTAL_URL,
      expiresAt,
    }, FIREBASE_PREVIEW_PARENT_ORIGIN);
  });

  it.each([
    `https://user:password@${new URL(FIREBASE_PREVIEW_PARENT_ORIGIN).hostname}`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}:443`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}:444`,
    `http://${new URL(FIREBASE_PREVIEW_PARENT_ORIGIN).hostname}`,
    `https://*.web.app`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}/`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}/contact/`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}?preview=1`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}#preview`,
    'HTTPS://cor-jp-main--preview-abc123.web.app',
    'https://COR-JP-MAIN--PREVIEW-ABC123.web.app',
    'https://cor-jp-main--preview-abc123%2Eweb.app',
    'https://cor-jp-main--preview-abc123.web.app.',
  ])('rejects non-canonical or unsafe configured parent origin %s', (configuredOrigin) => {
    expect(resolveAllowedEmbedParentOrigins(configuredOrigin)).toEqual(new Set([
      'https://cor-jp.com',
      'https://www.cor-jp.com',
    ]));
  });

  it.each([
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}.evil.example/contact/`,
    `https://user:password@${new URL(FIREBASE_PREVIEW_PARENT_ORIGIN).hostname}/contact/`,
    `${FIREBASE_PREVIEW_PARENT_ORIGIN}:443/contact/`,
    `http://${new URL(FIREBASE_PREVIEW_PARENT_ORIGIN).hostname}/contact/`,
    'HTTPS://cor-jp-main--preview-abc123.web.app/contact/',
    'https://COR-JP-MAIN--PREVIEW-ABC123.web.app/contact/',
    ' https://cor-jp-main--preview-abc123.web.app/contact/',
  ])('rejects a confused Firebase Preview referrer %s', (referrer) => {
    expect(resolveEmbedParentOrigin(
      referrer,
      'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
      FIREBASE_PREVIEW_PARENT_ORIGIN,
    )).toBeNull();
  });

  it('uses the same configured Preview origin contract before posting to an embed parent', () => {
    const browser = framedBrowser('https://cor-jp.com/contact/');
    const expiresAt = futureExpiry();

    expect(openGriftHandoff(PREVIEW_PORTAL_URL, true, browser, expiresAt, PREVIEW_ORIGIN))
      .toBe('messaged');
    expect(browser.parent.postMessage).toHaveBeenCalledWith({
      type: 'cloudia:grift-handoff-ready',
      url: PREVIEW_PORTAL_URL,
      expiresAt,
    }, 'https://cor-jp.com');

    const unlistedBrowser = framedBrowser('https://cor-jp.com/contact/');
    expect(openGriftHandoff(
      `https://unlisted.example.run.app/chat/portal#exchange_code=${EXCHANGE_CODE}`,
      true,
      unlistedBrowser,
      expiresAt,
      PREVIEW_ORIGIN,
    )).toBe('blocked');
    expect(unlistedBrowser.parent.postMessage).not.toHaveBeenCalled();
  });

  it('applies the same malformed-URL validator to standalone and iframe handoff', () => {
    for (const value of malformedPortalUrls()) {
      const standalone = topLevelBrowser();
      expect(openGriftHandoff(value, false, standalone, futureExpiry()), value).toBe('blocked');
      expect(standalone.location.assign).not.toHaveBeenCalled();

      const framed = framedBrowser('https://cor-jp.com/contact/');
      expect(openGriftHandoff(value, true, framed, futureExpiry()), value).toBe('blocked');
      expect(framed.parent.postMessage).not.toHaveBeenCalled();
    }
  });

  it('does not log or throw a rejected fragment credential', () => {
    const rejected = `https://evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => openGriftHandoff(rejected, false, topLevelBrowser(), futureExpiry())).not.toThrow();
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]))
      .not.toContain(rejected);
  });

  it('does not disclose a portal URL to an untrusted or origin-confused parent', () => {
    const expiresAt = futureExpiry();
    for (const referrer of [
      '',
      'not-a-url',
      'https://cor-jp.com.evil.example/contact/',
      'https://user:password@cor-jp.com/contact/',
      'http://cor-jp.com/contact/',
      'https://cor-jp.com:443/contact/',
      'HTTPS://cor-jp.com/contact/',
      'https://COR-JP.COM/contact/',
    ]) {
      const browser = framedBrowser(referrer);
      expect(openGriftHandoff(PORTAL_URL, true, browser, expiresAt), referrer).toBe('blocked');
      expect(browser.parent.postMessage).not.toHaveBeenCalled();
      expect(browser.location.assign).not.toHaveBeenCalled();
    }
  });

  it('does not navigate a framed page that omitted the embed contract', () => {
    const browser = framedBrowser('https://cor-jp.com/contact/');

    expect(openGriftHandoff(PORTAL_URL, false, browser, futureExpiry())).toBe('blocked');
    expect(browser.parent.postMessage).not.toHaveBeenCalled();
    expect(browser.location.assign).not.toHaveBeenCalled();
  });

  it('allows loopback parent origins only when the child is also loopback', () => {
    expect(resolveEmbedParentOrigin('http://localhost:4321/contact/', 'http://localhost:5173'))
      .toBe('http://localhost:4321');
    expect(resolveEmbedParentOrigin('http://localhost:4321/contact/', 'https://cloudia.pages.dev'))
      .toBeNull();
  });

  it('keeps the safe fallback link usable when browser navigation fails', () => {
    const browser = topLevelBrowser();
    browser.location.assign = vi.fn(() => { throw new Error('blocked'); });

    expect(openGriftHandoff(PORTAL_URL, false, browser, futureExpiry())).toBe('blocked');
  });

  it('blocks missing, expired, and over-five-minute exchange expiries at navigation time', () => {
    const browser = topLevelBrowser();

    expect(openGriftHandoff(PORTAL_URL, false, browser)).toBe('blocked');
    expect(openGriftHandoff(
      PORTAL_URL,
      false,
      browser,
      new Date(Date.now() - 1_000).toISOString(),
    )).toBe('blocked');
    expect(openGriftHandoff(
      PORTAL_URL,
      false,
      browser,
      futureExpiry(GRIFT_MAX_PORTAL_TTL_MS + 60_000),
    )).toBe('blocked');
    expect(browser.location.assign).not.toHaveBeenCalled();
  });

  it('normalizes only a live expiry within the five-minute exchange contract', () => {
    const now = Date.now();
    const valid = new Date(now + 60_000).toISOString();

    expect(parseValidGriftHandoffExpiry(valid, now)).toBe(valid);
    expect(parseValidGriftHandoffExpiry(new Date(now).toISOString(), now)).toBeNull();
    expect(parseValidGriftHandoffExpiry(
      new Date(now + GRIFT_MAX_PORTAL_TTL_MS + 1).toISOString(),
      now,
    )).toBeNull();
  });
});
