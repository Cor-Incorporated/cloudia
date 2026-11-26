/** The Grift link is recognized only by one exact canonical utm_source value. */
export function readContactEntryRoute(search: string): 'corJpDirect' | 'griftaiLink' {
  const sources = new URLSearchParams(search).getAll('utm_source');
  return sources.length === 1 && sources[0] === 'grift' ? 'griftaiLink' : 'corJpDirect';
}
