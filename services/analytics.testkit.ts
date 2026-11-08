/**
 * Test helpers for the GA4 tracking module. Only imported by *.test.ts files, so
 * it never reaches the production bundle.
 */
import type { AnalyticsScriptElement, AnalyticsWindow } from './analytics';

/** A well-formed measurement ID that is not the production one. */
export const TEST_GA4_ID = 'G-TESTID0001';

export interface FakeWindowOptions {
  hostname?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  referrer?: string;
  /** true: window.top is another window (the page runs inside an iframe). */
  framed?: boolean;
  /** true: reading window.top throws, as it does for a cross-origin parent. */
  topThrows?: boolean;
  /** true: history.replaceState throws, as it can in a sandboxed frame. */
  replaceStateThrows?: boolean;
  /** true: document.referrer cannot be redefined (a non-configurable property). */
  referrerLocked?: boolean;
}

export type FakeWindow = AnalyticsWindow & {
  scripts: AnalyticsScriptElement[];
  /** The URL argument of every history.replaceState call, in order. */
  replaceStateCalls: (string | null | undefined)[];
  /** Everything that happened, in order: 'replaceState' and 'script'. */
  order: string[];
};

export function createFakeWindow(options: FakeWindowOptions = {}): FakeWindow {
  const hostname = options.hostname ?? 'cor-jp.com';
  const self = {};
  const scripts: AnalyticsScriptElement[] = [];
  const replaceStateCalls: (string | null | undefined)[] = [];
  const order: string[] = [];
  const location = {
    hostname,
    origin: `https://${hostname}`,
    pathname: options.pathname ?? '/contact/chat/',
    search: options.search ?? '',
    hash: options.hash ?? '',
  };
  const win: FakeWindow = {
    location,
    history: {
      state: null,
      replaceState: (_data, _unused, url) => {
        if (options.replaceStateThrows) throw new Error('SecurityError: replaceState is not allowed here');
        replaceStateCalls.push(url);
        order.push('replaceState');
        // Behave like a browser: the location now shows the new URL.
        if (typeof url === 'string') {
          const next = new URL(url, location.origin);
          location.pathname = next.pathname;
          location.search = next.search;
          location.hash = next.hash;
        }
      },
    },
    document: {
      referrer: options.referrer ?? '',
      head: {
        appendChild: (node) => {
          scripts.push(node);
          order.push('script');
          return node;
        },
      },
      createElement: () => ({ async: false, src: '' }),
    },
    self,
    top: options.framed ? {} : self,
    scripts,
    replaceStateCalls,
    order,
  };
  if (options.referrerLocked) {
    Object.defineProperty(win.document, 'referrer', { value: options.referrer ?? '', configurable: false, writable: false });
  }
  if (options.topThrows) {
    Object.defineProperty(win, 'top', {
      get() {
        throw new Error('SecurityError: blocked a frame from accessing a cross-origin frame');
      },
    });
  }
  return win;
}

/** dataLayer entries as plain arrays (gtag pushes `arguments` objects). */
export function dataLayerEntries(win: AnalyticsWindow): unknown[][] {
  return (win.dataLayer ?? []).map((item) => Array.from(item as ArrayLike<unknown>));
}

/** Parameters of every `gtag('event', name, params)` call, in order. */
export function eventsNamed(win: AnalyticsWindow, name: string): unknown[] {
  return dataLayerEntries(win)
    .filter((entry) => entry[0] === 'event' && entry[1] === name)
    .map((entry) => entry[2]);
}
