/**
 * GA4 measurement for the Cloudia contact chat (cor-jp.com/contact/chat/).
 *
 * Two events, nothing else is sent by this module:
 * - contact_chat_view            one per page view (arrival)
 * - contact_chat_submit_success  after the Worker has accepted an inquiry
 *
 * Privacy boundary: the only values that leave the page are the event names, the
 * intent key, an allow-listed entry source (see ENTRY_SOURCES) and allow-listed
 * utm values (see ALLOWED_UTM). Typed text, names, e-mail addresses, conversation,
 * session ids, receipt numbers and arbitrary URL query parameters are never sent.
 * gtag.js builds page_location, form_destination and
 * page_referrer from the real URL and document.referrer, so start() first rewrites the
 * visible URL (history.replaceState: allow-listed query, no hash) and document.referrer
 * (origin and path only), then loads gtag.js. If either rewrite fails, nothing is loaded.
 *
 * Loading follows corsweb's Analytics.astro (gtag.js straight from Google, the ID
 * validated as G-XXXX, production host only, nothing in the launcher iframe), so
 * there is no new loading method and no consent layer to sit behind: corsweb has
 * no cookie banner; disclosure lives in its privacy policy.
 *
 * The measurement ID is a build-time value (VITE_GA4_ID). Unset means off.
 */
import { parseEntrySourceFromSearch, type EntrySource } from '../constants/entrySources';
import { parseContactIntent } from '../constants/intents';
import type { ContactIntent } from '../types';
import { resolveAppMode } from '../utils/appMode';
import { RECEIPT_ID_PATTERN, type SubmitResult } from './contactChatClient';

export const CONTACT_CHAT_VIEW_EVENT = 'contact_chat_view';
export const CONTACT_CHAT_SUBMIT_SUCCESS_EVENT = 'contact_chat_submit_success';

/** Same host check App.tsx uses; previews, localhost and www are not measured. */
export const PRODUCTION_HOSTNAME = 'cor-jp.com';

const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

/**
 * The only utm values that may be sent. griftai.org's CTA builder (src/lib/cor-cta.ts)
 * emits utm_source=grift and utm_medium=cta and no utm_campaign. A value that is not
 * listed is dropped, never echoed. Add new campaign values here, with a test.
 */
const ALLOWED_UTM = {
  utm_source: ['grift'],
  utm_medium: ['cta'],
  utm_campaign: [],
} as const satisfies Record<string, readonly string[]>;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export interface AnalyticsParams {
  intent?: ContactIntent;
  /** GA4 name. The page URL keeps the same value under `source`. */
  entry_source?: EntrySource;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/** The slice of `window` this module touches, so tests can pass a fake. */
export interface AnalyticsScriptElement {
  async: boolean;
  src: string;
}

export interface AnalyticsWindow {
  location: { hostname: string; origin: string; pathname: string; search: string; hash: string };
  history: {
    state: unknown;
    replaceState: (data: unknown, unused: string, url?: string | null) => void;
  };
  document: {
    referrer: string;
    head: { appendChild: (node: AnalyticsScriptElement) => unknown };
    createElement: (tag: 'script') => AnalyticsScriptElement;
  };
  self: unknown;
  top: unknown;
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  /** Set once this page view has been started; guards against a second start. */
  __corChatGa4Started?: boolean;
}

export interface Analytics {
  /** Loads gtag.js and sends the page view and the arrival event, once per page view. */
  start: () => void;
  /** Sends the completion event for an inquiry the Worker accepted, once per receipt. */
  trackSubmitSuccess: (receiptId: string, intent: ContactIntent | null) => void;
}

/** Trims and validates a measurement ID; anything that is not G-XXXX becomes ''. */
export function normalizeGa4Id(raw: string | null | undefined): string {
  const id = (raw ?? '').trim();
  return GA4_MEASUREMENT_ID.test(id) ? id : '';
}

/** The allow-listed values found in a query string. Nothing else survives. */
export function allowedParams(search: string): AnalyticsParams {
  const query = new URLSearchParams(search);
  const intent = parseContactIntent(query.get('intent'));
  const entrySource = parseEntrySourceFromSearch(search);
  const utm = UTM_KEYS.flatMap((key): [string, string][] => {
    const value = (query.get(key) ?? '').trim().toLowerCase();
    const allowed = (ALLOWED_UTM[key] as readonly string[]).find((candidate) => candidate === value);
    return allowed ? [[key, allowed]] : [];
  });
  return Object.fromEntries([
    ...(intent ? [['intent', intent]] : []),
    ...(entrySource ? [['entry_source', entrySource]] : []),
    ...utm,
  ]) as AnalyticsParams;
}

/**
 * The query the page URL may keep: the event values plus the `locale` the app reads
 * (LanguageContext accepts exactly 'ja' or 'en'). Anything else is dropped.
 */
export function allowedQuery(search: string): string {
  const params = allowedParams(search);
  const locale = new URLSearchParams(search).get('locale');
  const pairs: [string, string][] = [];
  if (params.intent) pairs.push(['intent', params.intent]);
  // The URL key stays `source`. The event parameter is `entry_source`.
  if (params.entry_source) pairs.push(['source', params.entry_source]);
  for (const key of UTM_KEYS) {
    const value = params[key];
    if (value) pairs.push([key, value]);
  }
  if (locale === 'ja' || locale === 'en') pairs.push(['locale', locale]);
  return new URLSearchParams(pairs).toString();
}

/** origin + path + allow-listed query. The hash and every other parameter are dropped. */
export function sanitizePageLocation(origin: string, pathname: string, search: string): string {
  const query = allowedQuery(search);
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

/** origin + path of an http(s) referrer, or '' when there is none or it is not a web URL. */
export function sanitizeReferrer(referrer: string): string {
  try {
    const url = new URL(referrer);
    return url.protocol === 'https:' || url.protocol === 'http:' ? `${url.origin}${url.pathname}` : '';
  } catch {
    return '';
  }
}

export interface TrackingContext {
  hostname: string;
  pathname: string;
  search: string;
  framed: boolean;
}

/** One place that decides whether this page view is measured at all. */
export function shouldTrack(ga4Id: string, context: TrackingContext): boolean {
  if (!ga4Id) return false;
  if (context.hostname !== PRODUCTION_HOSTNAME) return false;
  // The launcher iframe (?embed=1) lives on every corsweb page, which is already measured.
  if (context.framed || new URLSearchParams(context.search).get('embed') === '1') return false;
  // The ambassador demo is not part of the CTA path.
  return resolveAppMode(context.search, context.pathname) === 'intake';
}

function isFramed(win: AnalyticsWindow): boolean {
  try {
    return win.top !== win.self;
  } catch {
    return true; // a cross-origin parent throws: treat it as framed
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * True only for an answer that says "accepted": 2xx, `ok: true`, and a receipt number.
 * The Worker also answers 200 {ok:true} to honeypot hits (bots) without a receipt, and
 * the local mock does the same, so `ok` alone is not enough.
 */
export function isAcceptedSubmission(result: SubmitResult): result is SubmitResult & { receiptId: string } {
  return (
    result.ok === true &&
    result.status >= 200 &&
    result.status < 300 &&
    typeof result.receiptId === 'string' &&
    isRecord(result.body) &&
    result.body.ok === true
  );
}

function loadGtag(win: AnalyticsWindow, ga4Id: string): (...args: unknown[]) => void {
  const dataLayer = win.dataLayer ?? [];
  win.dataLayer = dataLayer;
  // gtag.js needs the Arguments object itself in the dataLayer, not an array.
  win.gtag =
    win.gtag ??
    (function () {
      dataLayer.push(arguments);
    } as (...args: unknown[]) => void);
  const script = win.document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
  win.document.head.appendChild(script);
  return win.gtag;
}

export function createAnalytics(win: AnalyticsWindow | undefined, rawGa4Id: string | null | undefined): Analytics {
  const ga4Id = normalizeGa4Id(rawGa4Id);
  const reportedReceipts = new Set<string>();
  let pageParams: AnalyticsParams = {};

  const isEnabled = (target: AnalyticsWindow | undefined): target is AnalyticsWindow =>
    target !== undefined &&
    shouldTrack(ga4Id, {
      hostname: target.location.hostname,
      pathname: target.location.pathname,
      search: target.location.search,
      framed: isFramed(target),
    });

  return {
    start() {
      if (!isEnabled(win) || win.__corChatGa4Started) return;
      win.__corChatGa4Started = true;
      const { origin, pathname, search, hash } = win.location;
      const pageLocation = sanitizePageLocation(origin, pathname, search);
      const cleanSearch = pageLocation.slice(`${origin}${pathname}`.length);
      const referrer = sanitizeReferrer(win.document.referrer);
      // gtag.js builds page_location (the automatic page_view, scroll, the history-change
      // page_view after the app rewrites ?intent=), the form events' form_destination (the
      // whole URL, hash included) and page_referrer from the real URL and document.referrer.
      // With the live property's settings it ignores the page_location / page_referrer given
      // to `config` (measured 2026-11-08). So the real URL and document.referrer are cleaned
      // first, before gtag.js can read them. If either fails, nothing is loaded.
      try {
        if (cleanSearch !== search || hash !== '') {
          win.history.replaceState(win.history.state, '', `${pathname}${cleanSearch}`);
        }
        if (win.document.referrer !== referrer) {
          Object.defineProperty(win.document, 'referrer', { value: referrer, configurable: true });
        }
      } catch {
        return;
      }
      const gtag = loadGtag(win, ga4Id);
      gtag('js', new Date());
      // Also given to `config` as a backstop for tag settings that do honour it.
      gtag('config', ga4Id, {
        page_location: pageLocation,
        ...(referrer ? { page_referrer: referrer } : {}),
      });
      pageParams = allowedParams(search);
      gtag('event', CONTACT_CHAT_VIEW_EVENT, pageParams);
    },

    trackSubmitSuccess(receiptId, intent) {
      if (!isEnabled(win) || !win.__corChatGa4Started || !win.gtag) return;
      if (!RECEIPT_ID_PATTERN.test(receiptId) || reportedReceipts.has(receiptId)) return;
      // The receipt number is only used here to count an inquiry once. It is not sent.
      reportedReceipts.add(receiptId);
      const safeIntent = parseContactIntent(intent);
      const params: AnalyticsParams = {
        ...(safeIntent ? { intent: safeIntent } : {}),
        ...(pageParams.entry_source ? { entry_source: pageParams.entry_source } : {}),
      };
      win.gtag('event', CONTACT_CHAT_SUBMIT_SUCCESS_EVENT, params);
    },
  };
}

/** The tracker for this page view. Off wherever there is no window or no VITE_GA4_ID. */
export const analytics: Analytics = createAnalytics(
  typeof window === 'undefined' ? undefined : (window as unknown as AnalyticsWindow),
  import.meta.env.VITE_GA4_ID,
);

/** Call once, before React renders, so StrictMode's double invocation cannot repeat it. */
export function startAnalytics(): void {
  analytics.start();
}
