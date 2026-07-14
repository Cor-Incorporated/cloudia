/**
 * Return an unchanged canonical HTTPS origin or null.
 *
 * Callers split comma-separated configuration before invoking this helper.
 * Equality with URL.origin rejects credentials, explicit ports (including
 * :443), paths, queries, fragments, case/encoding normalization, and other
 * alternate spellings. A trailing DNS dot is rejected explicitly because the
 * URL implementation preserves it while DNS resolution may treat it as equal.
 */
export function parseCanonicalExactHttpsOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.includes('*')) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.hostname.endsWith('.')
      || url.pathname !== '/'
      || url.search
      || url.hash
      || value !== url.origin
    ) return null;
    return value;
  } catch {
    return null;
  }
}
