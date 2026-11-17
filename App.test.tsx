import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
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
    expect(markup).toContain('aria-label="Cor. のサイトに戻る"');
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

    stubBrowser({ search: '', referrer: 'https://cor-jp.com/contact/chat/', storage: shared });
    const second = renderApp();
    expect(second).toContain('href="https://cor-jp.com/industries/medical/"');
    expect(second).not.toContain('href="https://cor-jp.com/contact/chat/"');
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
