import { CONTACT_INTENT_DISPLAY_OPTIONS } from '../constants/intents';
import { ENTRY_SOURCES, INDUSTRY_ENTRY_SOURCES } from '../constants/entrySources';

export interface CloudiaRoute {
  id: string;
  path: string;
  search: string;
}

function route(id: string, search: string): CloudiaRoute {
  return { id, path: '/', search: search.startsWith('?') ? search : `?${search}` };
}

/** 公開面のルート一覧（SPA の path + query 状態）。 */
export const CLOUDIA_ROUTES: CloudiaRoute[] = [
  route('intake-ja', ''),
  route('intake-en', 'locale=en'),
  route('ambassador-query-ja', 'mode=ambassador'),
  route('ambassador-query-en', 'mode=ambassador&locale=en'),
  route('ambassador-path', ''),
  route('embed-ja', 'embed=1'),
  route('embed-en', 'embed=1&locale=en'),
  ...CONTACT_INTENT_DISPLAY_OPTIONS.map((option) =>
    route(`intent-${option.id}`, `intent=${option.primaryIntent}`),
  ),
  ...INDUSTRY_ENTRY_SOURCES.map((source) => route(`industry-${source}`, `source=${source}`)),
  ...ENTRY_SOURCES.filter((source) => !(INDUSTRY_ENTRY_SOURCES as readonly string[]).includes(source)).map(
    (source) => route(`entry-${source}`, `source=${source}`),
  ),
  route('industry-intent-medical-contract', 'source=industry-medical&intent=contract-dev'),
  route('industry-intent-education-grift', 'source=industry-education&intent=grift-team-beta'),
];

/** ambassador-path だけ pathname が違う。 */
export function resolveUrl(route: CloudiaRoute, baseURL: string): string {
  const url = new URL(baseURL);
  if (route.id === 'ambassador-path') {
    url.pathname = url.pathname.replace(/\/?$/, '/ambassador/');
    url.search = route.search.replace(/^\?/, '');
    return url.toString();
  }
  url.search = route.search.replace(/^\?/, '');
  return url.toString();
}