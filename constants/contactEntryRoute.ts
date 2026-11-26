export type ContactEntryRoute = 'corJpDirect' | 'griftaiLink';

/** The Grift link is recognized only by one exact canonical utm_source value. */
export function readContactEntryRoute(search: string): ContactEntryRoute {
  const sources = new URLSearchParams(search).getAll('utm_source');
  return sources.length === 1 && sources[0] === 'grift' ? 'griftaiLink' : 'corJpDirect';
}

/** Keep the established direct key and resume Grift sessions within their own route. */
export function contactSessionKey(baseKey: string, route: ContactEntryRoute): string {
  return route === 'griftaiLink' ? `${baseKey}:grift` : baseKey;
}
