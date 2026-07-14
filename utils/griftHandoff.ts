import { parseCanonicalExactHttpsOrigin } from './exactHttpsOrigin';

export const GRIFT_HANDOFF_MESSAGE_TYPE = 'cloudia:grift-handoff-ready';
export const GRIFT_MAX_PORTAL_TTL_MS = 5 * 60 * 1000;

export const GRIFT_PRODUCTION_PUBLIC_ORIGIN = 'https://app.griftai.org';
const GRIFT_PORTAL_PATH = '/chat/portal';
const GRIFT_EXCHANGE_FRAGMENT = /^#exchange_code=([A-Za-z0-9_-]{43})$/;
// A canonical no-padding base64url encoding of 32 bytes has 43 characters;
// its final character carries four data bits and two zero padding bits.
const GRIFT_32_BYTE_BASE64URL = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const CONFIGURED_GRIFT_PUBLIC_URL_ORIGINS = import.meta.env.VITE_GRIFT_PUBLIC_URL_ORIGINS;
const CONFIGURED_EMBED_PARENT_ORIGINS = import.meta.env.VITE_CLOUDIA_EMBED_PARENT_ORIGINS;
const PRODUCTION_EMBED_PARENT_ORIGINS = new Set([
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

/**
 * Build an exact HTTPS origin allowlist. Production is always present; a
 * Preview/Staging build may append explicit origins through its public Vite
 * build variable. Invalid entries and wildcard-like values are ignored.
 */
export function resolveAllowedGriftPublicOrigins(
  configuredOrigins: unknown = CONFIGURED_GRIFT_PUBLIC_URL_ORIGINS,
): ReadonlySet<string> {
  const origins = new Set<string>([GRIFT_PRODUCTION_PUBLIC_ORIGIN]);
  if (typeof configuredOrigins !== 'string') return origins;

  for (const rawOrigin of configuredOrigins.split(',')) {
    const candidate = rawOrigin.trim();
    if (!candidate || candidate.includes('*')) continue;
    try {
      const url = new URL(candidate);
      if (
        url.protocol !== 'https:'
        || url.username
        || url.password
        || url.port
        || url.pathname !== '/'
        || url.search
        || url.hash
        || candidate !== url.origin
      ) continue;
      origins.add(url.origin);
    } catch {
      // Fail closed: malformed configured entries never widen the allowlist.
    }
  }
  return origins;
}

export function parseAllowedGriftHandoffUrl(
  value: unknown,
  configuredOrigins: unknown = CONFIGURED_GRIFT_PUBLIC_URL_ORIGINS,
): string | null {
  if (typeof value !== 'string' || !value || value.length > 2048 || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (!resolveAllowedGriftPublicOrigins(configuredOrigins).has(url.origin)) return null;
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.pathname !== GRIFT_PORTAL_PATH || url.search) return null;
    const fragment = GRIFT_EXCHANGE_FRAGMENT.exec(url.hash);
    if (!fragment || !GRIFT_32_BYTE_BASE64URL.test(fragment[1])) return null;
    // Equality with the canonical raw form rejects explicit default ports,
    // encoded credentials/keys, alternate path spellings, and URL rewriting.
    const canonical = `${url.origin}${GRIFT_PORTAL_PATH}#exchange_code=${fragment[1]}`;
    return value === canonical ? value : null;
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

/**
 * Build the parent-frame allowlist from canonical HTTPS origins only.
 *
 * Vite build configuration erases the public Preview variable from production
 * artifacts. This runtime parser remains fail-closed as a second boundary: it
 * rejects credentials, wildcards, paths, ports (including an explicit :443),
 * and any input whose spelling differs from URL's canonical origin.
 */
export function resolveAllowedEmbedParentOrigins(
  configuredOrigins: unknown = CONFIGURED_EMBED_PARENT_ORIGINS,
): ReadonlySet<string> {
  const origins = new Set(PRODUCTION_EMBED_PARENT_ORIGINS);
  if (typeof configuredOrigins !== 'string') return origins;

  for (const rawOrigin of configuredOrigins.split(',')) {
    const candidate = rawOrigin.trim();
    const origin = parseCanonicalExactHttpsOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

function rawOriginPrefix(value: string): string | null {
  return /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*)(?:[/?#]|$)/.exec(value)?.[1] ?? null;
}

export function resolveEmbedParentOrigin(
  referrer: unknown,
  childOrigin: unknown,
  configuredOrigins: unknown = CONFIGURED_EMBED_PARENT_ORIGINS,
): string | null {
  if (
    typeof referrer !== 'string'
    || !referrer
    || referrer !== referrer.trim()
    || typeof childOrigin !== 'string'
  ) return null;
  try {
    const parentUrl = new URL(referrer);
    if (parentUrl.username || parentUrl.password) return null;
    const rawParentOrigin = rawOriginPrefix(referrer);
    const trustedHttpsParent = parentUrl.protocol === 'https:'
      && !parentUrl.port
      && rawParentOrigin === parentUrl.origin
      && resolveAllowedEmbedParentOrigins(configuredOrigins).has(parentUrl.origin);
    if (trustedHttpsParent) return parentUrl.origin;

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
  configuredOrigins: unknown = CONFIGURED_GRIFT_PUBLIC_URL_ORIGINS,
  configuredEmbedParentOrigins: unknown = CONFIGURED_EMBED_PARENT_ORIGINS,
): GriftHandoffAction {
  // Both top-level navigation and the URL sent to an embedded parent cross the
  // same exact-origin/path/token validation boundary.
  const url = parseAllowedGriftHandoffUrl(value, configuredOrigins);
  const validExpiry = parseValidGriftHandoffExpiry(expiresAt);
  if (!url || !validExpiry) return 'blocked';
  const isFramed = browser.parent !== browser;
  if (isFramed) {
    if (!embed) return 'blocked';
    const targetOrigin = resolveEmbedParentOrigin(
      browser.document?.referrer,
      browser.location.origin,
      configuredEmbedParentOrigins,
    );
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
