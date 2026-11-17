import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { RETURN_TARGET_STORAGE_KEY, persistReturnTarget } from './utils/returnTarget';
import { translations } from './translations';

const INTRO_KEYS = [
  'introHeading',
  'introHandoff',
  'introChatBefore',
  'introChatAfter',
  'introReceptionBefore',
  'introReceptionLink',
  'introReceptionAfter',
  'introCalendarBefore',
  'introCalendarLink',
  'introCalendarAfter',
  'introBookingPreparation',
  'backToGriftSite',
  'backToCorSite',
  'backToPreviousPage',
] as const;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

type StorageStub = ReturnType<typeof memoryStorage>;

function stubBrowser({ search = '', referrer = '', storage }: { search?: string; referrer?: string; storage?: StorageStub } = {}) {
  const store = storage ?? memoryStorage();
  vi.stubGlobal('window', {
    location: {
      search,
      href: `https://cor-jp.com/contact/chat/${search}`,
      hostname: 'cor-jp.com',
      pathname: '/contact/chat/',
    },
    sessionStorage: store,
    confirm: () => true,
  });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  vi.stubGlobal('document', { referrer, title: '' });
}

function renderApp(props: { bookingNoticeVisible?: boolean } = {}): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <App {...props} />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App header return link (outside the embed frame)', () => {
  it('shows a clearly readable return link to the site top in Japanese', () => {
    stubBrowser({ search: '' });
    const markup = renderApp();

    expect(markup).toContain('href="/"');
    expect(markup).toContain('Cor. のサイトに戻る');
    // 戻る link は文字の 1 本だけ（絵は link にしない）。
    expect(markup.match(/Cor\. のサイトに戻る/g)).toHaveLength(1);
  });

  it('points to the English site top when the UI language is English', () => {
    stubBrowser({ search: '?locale=en' });
    const markup = renderApp();

    expect(markup).toContain('href="/en/"');
    expect(markup).toContain('Back to the Cor. site');
  });

  it('keeps the same return target across re-renders instead of following in-chat transitions', () => {
    const shared = memoryStorage();
    stubBrowser({ search: '', referrer: 'https://cor-jp.com/industries/medical/', storage: shared });
    const first = renderApp();
    expect(first).toContain('href="https://cor-jp.com/industries/medical/"');

    // The write happens in a commit-phase effect, which static rendering does not run;
    // persist the first page load's decision the same way App does.
    persistReturnTarget({ href: 'https://cor-jp.com/industries/medical/', save: 'https://cor-jp.com/industries/medical/', clear: false }, shared);

    stubBrowser({ search: '', referrer: 'https://cor-jp.com/contact/chat/', storage: shared });
    const second = renderApp();
    expect(second).toContain('href="https://cor-jp.com/industries/medical/"');
    expect(second).not.toContain('href="https://cor-jp.com/contact/chat/"');
  });

  it('renders one return link in the header and leaves the avatar out of the link', () => {
    stubBrowser({ search: '?source=industry-medical' });
    const markup = renderApp();

    const headerStart = markup.indexOf('<header id="app-header"');
    expect(headerStart).toBeGreaterThan(-1);
    const header = markup.slice(headerStart, markup.indexOf('</header>', headerStart));
    expect(header.match(/href="\/industries\/medical\/"/g) ?? []).toHaveLength(1);
  });
});

describe('App embed mode', () => {
  it('hides the header and the return link inside the embed frame, but still shows the intro panel', () => {
    stubBrowser({ search: '?embed=1' });
    const markup = renderApp();

    expect(markup).toContain('data-embed="true"');
    expect(markup).not.toContain('app-header');
    expect(markup).not.toContain('のサイトに戻る');
    expect(markup).toContain('公式の AI 受付');
    expect(markup).toContain('href="/contact/?source=footer-calendar#contact-calendar" target="_top"');
  });
});

describe('intro panel', () => {
  it('defines every intro and back-link key in both Japanese and English', () => {
    for (const key of INTRO_KEYS) {
      expect(typeof translations.ja[key], `ja:${key}`).toBe('string');
      expect((translations.ja[key] as string).length, `ja:${key}`).toBeGreaterThan(0);
      expect(typeof translations.en[key], `en:${key}`).toBe('string');
      expect((translations.en[key] as string).length, `en:${key}`).toBeGreaterThan(0);
    }
  });

  it('shows the reception heading, the calendar link and the preparation line', () => {
    stubBrowser({ search: '' });
    const markup = renderApp();

    expect(markup).toContain('ここは、Cor.株式会社の公式の AI 受付です');
    expect(markup).toContain('href="/contact/?source=footer-calendar#contact-calendar"');
    expect(markup).toContain('この画面からの打ち合わせの予約は、準備中です。');
    expect(markup).toContain('href="/contact/chat/ambassador/"');
  });

  it('renders the English copy for the same panel', () => {
    stubBrowser({ search: '?locale=en' });
    const markup = renderApp();

    expect(markup).toContain('This is the official AI reception of Cor. Inc.');
    expect(markup).toContain('Booking a meeting from this page is in preparation.');
  });

  it('hides the preparation line when the flag is off', () => {
    stubBrowser({ search: '' });
    const markup = renderApp({ bookingNoticeVisible: false });

    expect(markup).toContain('ここは、Cor.株式会社の公式の AI 受付です');
    expect(markup).not.toContain('準備中');
  });

  it('shows the not-available note instead of the preparation line for an industry entry', () => {
    stubBrowser({ search: '?source=industry-medical' });
    const markup = renderApp();

    expect(markup).not.toContain(translations.ja.introBookingPreparation);
    expect(markup).toContain(translations.ja.unavailableExtensions);
  });
});

describe('return target when sessionStorage cannot be read', () => {
  it('renders the third-stage target instead of crashing on the sessionStorage getter', () => {
    const win = {
      location: {
        search: '?source=industry-medical',
        href: 'https://cor-jp.com/contact/chat/?source=industry-medical',
        hostname: 'cor-jp.com',
        pathname: '/contact/chat/',
      },
      confirm: () => true,
    };
    Object.defineProperty(win, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage access blocked');
      },
    });
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', { language: 'ja-JP' });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal('document', { referrer: '', title: '' });

    const markup = renderApp();
    expect(markup).toContain('href="/industries/medical/"');
  });
});

describe('return target persistence effect', () => {
  it('clears a stale stored target after a source= entry', async () => {
    const stale = memoryStorage();
    stale.setItem(RETURN_TARGET_STORAGE_KEY, 'https://cor-jp.com/industries/shigyo/');

    vi.resetModules();
    // Static rendering never runs effects. Run only the return-target effect (its
    // dependency is the only decision object with `href` and `clear`) so the
    // persistence wiring itself is exercised.
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return {
        ...actual,
        useEffect: (effect: () => void, deps?: unknown[]) => {
          const isReturnTargetEffect =
            Array.isArray(deps) &&
            deps.some(
              (dep) => typeof dep === 'object' && dep !== null && 'href' in dep && 'clear' in dep,
            );
          if (isReturnTargetEffect) effect();
        },
      };
    });
    try {
      stubBrowser({ search: '?source=industry-medical', storage: stale });
      const [{ default: FreshApp }, { LanguageProvider: FreshProvider }, { renderToStaticMarkup: renderFresh }] =
        await Promise.all([import('./App'), import('./contexts/LanguageContext'), import('react-dom/server')]);
      const markup = renderFresh(
        <FreshProvider>
          <FreshApp />
        </FreshProvider>,
      );

      expect(markup).toContain('href="/industries/medical/"');
      expect(stale.getItem(RETURN_TARGET_STORAGE_KEY)).toBeNull();
    } finally {
      vi.doUnmock('react');
      vi.resetModules();
    }
  });
});

describe('color alignment with the site', () => {
  it('keeps the blue palette out of the screen source', () => {
    const files = [
      'App.tsx',
      'index.css',
      'index.html',
      ...readdirSync(join(import.meta.dirname, 'components'))
        .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
        .map((name) => join('components', name)),
    ];
    for (const file of files) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      expect(source, `${file} still has a blue class`).not.toMatch(/blue-\d/);
    }
  });
});

describe('App header return link recomputation', () => {
  it('recomputes the return target from the new entry instead of reusing the stored site top', () => {
    const stale = memoryStorage();
    stale.setItem(RETURN_TARGET_STORAGE_KEY, '/');
    stubBrowser({ search: '?locale=en&source=industry-medical', storage: stale });
    const markup = renderApp();

    expect(markup).toContain('href="/en/industries/medical/"');
    expect(markup).not.toContain('href="/"');
  });
});

describe('header heading structure', () => {
  it('keeps the h1 outside the return anchor and out of the wrapping span', () => {
    stubBrowser({ search: '' });
    const markup = renderApp();

    const h1Index = markup.indexOf('<h1');
    expect(h1Index).toBeGreaterThan(-1);

    // 題の直前の開始 tag は div（span の中に h1 は置けない）。
    expect(markup.slice(0, h1Index)).toMatch(/<div[^>]*>$/);
    expect(markup.slice(0, h1Index)).not.toMatch(/<span[^>]*>$/);

    // h1 はどの a の子孫でもない（link の aria-label が題を読み替えないように）。
    for (const anchor of markup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) {
      const start = anchor.index ?? 0;
      expect(h1Index >= start && h1Index < start + anchor[0].length).toBe(false);
    }
  });
});

describe('font loading', () => {
  it('does not preload fonts that no @font-face rule uses', () => {
    const source = readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');
    expect(source).not.toContain('fonts.gstatic.com');
  });

  it('has no preload or preconnect to an external host', () => {
    const source = readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');
    const links = source.match(/<link\b[^>]*>/g) ?? [];

    for (const link of links) {
      const rel = link.match(/\brel="([^"]*)"/)?.[1] ?? '';
      if (!/^(preload|preconnect)$/i.test(rel)) continue;
      const href = link.match(/\bhref="([^"]*)"/)?.[1] ?? '';
      expect(href, `external ${rel}: ${link}`).not.toMatch(/^https?:\/\//i);
    }
  });
});
