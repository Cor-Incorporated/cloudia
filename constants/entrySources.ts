/**
 * Entry sources the contact chat may keep.
 *
 * Contract: corsweb docs/industry-chat-worker-contract-2026-11-08.md and the
 * reception contract fixture constants/fixtures/industry-reception-contract.v1.json,
 * which corsweb's contact Worker checks with the same bytes.
 * The Worker trims and then exact-matches. This client does not trim a
 * different string into a token. Unknown values, a repeated `source`, and
 * anything that looks like an address or a phone number are dropped and never
 * copied into the URL, GA4, or the chat request.
 *
 * The five industry tokens are the only ones that change the first reply.
 * The other tokens are known generic tags. They are not industries.
 * `cloudia` is what we send when the page has no allow-listed source.
 */

export const INDUSTRY_ENTRY_SOURCES = [
  'industry-medical',
  'industry-shigyo',
  'industry-construction',
  'industry-manufacturing',
  'industry-education',
] as const;

export type IndustryEntrySource = (typeof INDUSTRY_ENTRY_SOURCES)[number];

/** Known generic tags. Not industries, so they do not add an industry question. */
export const OTHER_ENTRY_SOURCES = [
  'corsweb-contact-primary',
  'corsweb-launcher',
  'corsweb-launcher-fallback',
] as const;

export type OtherEntrySource = (typeof OTHER_ENTRY_SOURCES)[number];

export type EntrySource = IndustryEntrySource | OtherEntrySource;

export const ENTRY_SOURCES: readonly EntrySource[] = [
  ...INDUSTRY_ENTRY_SOURCES,
  ...OTHER_ENTRY_SOURCES,
];

/** A value that could carry an address or a phone number is never an entry source. */
const PII_LIKE = /@|\d[\d\s().-]{6,}/;

export function isIndustryEntrySource(value: EntrySource | null | undefined): value is IndustryEntrySource {
  return value != null && (INDUSTRY_ENTRY_SOURCES as readonly string[]).includes(value);
}

/**
 * Accepts only the exact enum token. Surrounding space, a different case, and
 * a value with extra characters all fail. Nothing is rewritten into the token.
 */
export function parseEntrySourceValue(raw: unknown): EntrySource | null {
  if (typeof raw !== 'string') return null;
  if (raw !== raw.trim() || raw !== raw.toLowerCase()) return null;
  if (PII_LIKE.test(raw)) return null;
  return (ENTRY_SOURCES as readonly string[]).includes(raw) ? (raw as EntrySource) : null;
}

/**
 * Reads `source` from a query string.
 * Zero values and two or more values (a repeated key) both yield null.
 * The first of several values is not kept.
 */
export function parseEntrySourceFromSearch(search: string): EntrySource | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const values = params.getAll('source');
  if (values.length !== 1) return null;
  return parseEntrySourceValue(values[0]);
}
