import { describe, expect, it, vi } from 'vitest';
import {
  GRIFT_MAX_PORTAL_TTL_MS,
  openGriftHandoff,
  parseAllowedGriftHandoffUrl,
  parseValidGriftHandoffExpiry,
  resolveEmbedParentOrigin,
  type GriftHandoffBrowser,
} from './griftHandoff';

function futureExpiry(offsetMs = 60 * 60 * 1000): string {
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

describe('Grift handoff navigation', () => {
  it('allows only the exact public Grift portal URL shape', () => {
    expect(parseAllowedGriftHandoffUrl('https://app.griftai.org/chat/portal/opaque-token'))
      .toBe('https://app.griftai.org/chat/portal/opaque-token');

    for (const value of [
      'http://app.griftai.org/chat/portal/token',
      'https://app.griftai.org:444/chat/portal/token',
      'https://user:password@app.griftai.org/chat/portal/token',
      'https://app.griftai.org.evil.example/chat/portal/token',
      'https://evil.example/chat/portal/token',
      'https://app.griftai.org/admin',
      'https://app.griftai.org/chat/portal/token/',
      'https://app.griftai.org/chat/portal/token/next',
      'https://app.griftai.org/chat/portal/token?next=https://evil.example',
      'https://app.griftai.org/chat/portal/token#next',
      'https://app.griftai.org/chat/portal/token%2Fadmin',
      'https://app.griftai.org/chat/portal/%2e%2e%2Fadmin',
    ]) {
      expect(parseAllowedGriftHandoffUrl(value), value).toBeNull();
    }
  });

  it('navigates only a top-level standalone visitor', () => {
    const browser = topLevelBrowser();
    const expiresAt = futureExpiry();

    expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', false, browser, expiresAt))
      .toBe('navigated');
    expect(browser.location.assign).toHaveBeenCalledWith('https://app.griftai.org/chat/portal/token');

    expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', true, browser, expiresAt))
      .toBe('navigated');
  });

  it('notifies an allowlisted parent origin in embed mode', () => {
    const browser = framedBrowser('https://www.cor-jp.com/contact/?intent=contract-dev');
    const expiresAt = futureExpiry();

    expect(openGriftHandoff(
      'https://app.griftai.org/chat/portal/token',
      true,
      browser,
      expiresAt,
    )).toBe('messaged');
    expect(browser.parent.postMessage).toHaveBeenCalledWith({
      type: 'cloudia:grift-handoff-ready',
      url: 'https://app.griftai.org/chat/portal/token',
      expiresAt,
    }, 'https://www.cor-jp.com');
    expect(browser.location.assign).not.toHaveBeenCalled();
  });

  it('does not leak a portal URL to an untrusted or origin-confused parent', () => {
    const expiresAt = futureExpiry();
    for (const referrer of [
      '',
      'not-a-url',
      'https://cor-jp.com.evil.example/contact/',
      'https://user:password@cor-jp.com/contact/',
      'http://cor-jp.com/contact/',
    ]) {
      const browser = framedBrowser(referrer);
      expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', true, browser, expiresAt), referrer)
        .toBe('blocked');
      expect(browser.parent.postMessage).not.toHaveBeenCalled();
      expect(browser.location.assign).not.toHaveBeenCalled();
    }
  });

  it('does not navigate a framed page that omitted the embed contract', () => {
    const browser = framedBrowser('https://cor-jp.com/contact/');

    expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', false, browser, futureExpiry()))
      .toBe('blocked');
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

    expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', false, browser, futureExpiry()))
      .toBe('blocked');
  });

  it('blocks missing, expired, and overlong portal expiries at navigation time', () => {
    const browser = topLevelBrowser();

    expect(openGriftHandoff('https://app.griftai.org/chat/portal/token', false, browser))
      .toBe('blocked');
    expect(openGriftHandoff(
      'https://app.griftai.org/chat/portal/token',
      false,
      browser,
      new Date(Date.now() - 1_000).toISOString(),
    )).toBe('blocked');
    expect(openGriftHandoff(
      'https://app.griftai.org/chat/portal/token',
      false,
      browser,
      futureExpiry(GRIFT_MAX_PORTAL_TTL_MS + 60_000),
    )).toBe('blocked');
    expect(browser.location.assign).not.toHaveBeenCalled();
  });

  it('normalizes only a live expiry within the 24-hour contract', () => {
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
