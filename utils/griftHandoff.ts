export const GRIFT_HANDOFF_MESSAGE_TYPE = 'cloudia:grift-handoff-ready';
export const GRIFT_MAX_PORTAL_TTL_MS = 24 * 60 * 60 * 1000;

const GRIFT_PUBLIC_ORIGIN = 'https://app.griftai.org';
const GRIFT_PORTAL_PATH = /^\/chat\/portal\/[A-Za-z0-9._~-]{1,512}$/;
const TRUSTED_EMBED_PARENT_ORIGINS = new Set([
  'https://cor-jp.com',
  'https://www.cor-jp.com',
]);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

interface GriftMessageTarget {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export interface GriftHandoffBrowser extends GriftMessageTarget {
  location: {
    origin: string;
    assign: (url: string) => void;
  };
  document?: {
    referrer: string;
  };
  parent: GriftMessageTarget;
}

export type GriftHandoffAction = 'navigated' | 'messaged' | 'blocked';

export function parseAllowedGriftHandoffUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.origin !== GRIFT_PUBLIC_ORIGIN) return null;
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!GRIFT_PORTAL_PATH.test(url.pathname)) return null;
    if (url.search || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseValidGriftHandoffExpiry(value: unknown, now = Date.now()): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + GRIFT_MAX_PORTAL_TTL_MS) {
    return null;
  }
  return new Date(expiresAt).toISOString();
}

export function resolveEmbedParentOrigin(referrer: unknown, childOrigin: unknown): string | null {
  if (typeof referrer !== 'string' || !referrer.trim() || typeof childOrigin !== 'string') return null;
  try {
    const parentUrl = new URL(referrer);
    if (parentUrl.username || parentUrl.password) return null;
    if (TRUSTED_EMBED_PARENT_ORIGINS.has(parentUrl.origin)) return parentUrl.origin;

    const childUrl = new URL(childOrigin);
    const localDevelopment = LOOPBACK_HOSTS.has(childUrl.hostname)
      && LOOPBACK_HOSTS.has(parentUrl.hostname)
      && (childUrl.protocol === 'http:' || childUrl.protocol === 'https:')
      && (parentUrl.protocol === 'http:' || parentUrl.protocol === 'https:');
    return localDevelopment ? parentUrl.origin : null;
  } catch {
    return null;
  }
}

export function openGriftHandoff(
  value: unknown,
  embed: boolean,
  browser: GriftHandoffBrowser = window,
  expiresAt?: string,
): GriftHandoffAction {
  const url = parseAllowedGriftHandoffUrl(value);
  const validExpiry = parseValidGriftHandoffExpiry(expiresAt);
  if (!url || !validExpiry) return 'blocked';
  const isFramed = browser.parent !== browser;
  if (isFramed) {
    if (!embed) return 'blocked';
    const targetOrigin = resolveEmbedParentOrigin(browser.document?.referrer, browser.location.origin);
    if (!targetOrigin) return 'blocked';
    try {
      browser.parent.postMessage({
        type: GRIFT_HANDOFF_MESSAGE_TYPE,
        url,
        expiresAt: validExpiry,
      }, targetOrigin);
      return 'messaged';
    } catch {
      return 'blocked';
    }
  }
  try {
    browser.location.assign(url);
    return 'navigated';
  } catch {
    return 'blocked';
  }
}
