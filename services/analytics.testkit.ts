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
  referrer?: string;
  /** true: window.top is another window (the page runs inside an iframe). */
  framed?: boolean;
  /** true: reading window.top throws, as it does for a cross-origin parent. */
  topThrows?: boolean;
}

export type FakeWindow = AnalyticsWindow & { scripts: AnalyticsScriptElement[] };

export function createFakeWindow(options: FakeWindowOptions = {}): FakeWindow {
  const hostname = options.hostname ?? 'cor-jp.com';
  const self = {};
  const scripts: AnalyticsScriptElement[] = [];
  const win: FakeWindow = {
    location: {
      hostname,
      origin: `https://${hostname}`,
      pathname: options.pathname ?? '/contact/chat/',
      search: options.search ?? '',
    },
    document: {
      referrer: options.referrer ?? '',
      head: {
        appendChild: (node) => {
          scripts.push(node);
          return node;
        },
      },
      createElement: () => ({ async: false, src: '' }),
    },
    self,
    top: options.framed ? {} : self,
    scripts,
  };
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
