import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { RETURN_TARGET_STORAGE_KEY, persistReturnTarget } from './utils/returnTarget';
import { translations } from './translations';
import { INDUSTRY_ENTRY_SOURCES } from './constants/entrySources';
import { industryGuidance, industryPrivacyBoundary, industryQuestion } from './constants/industryGuidance';
import { industryEntryLocale } from './utils/contactLocale';

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

function renderApp(): string {
  // index.tsx and same wiring: zh, ko, es of an industry page open in English.
  const initialLocale = typeof window !== 'undefined' ? industryEntryLocale(window.location.search) : null;
  return renderToStaticMarkup(
    <LanguageProvider initialLocale={initialLocale}>
      <App />
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
    // 戻る link の文字の 1 本だけ（絵は link にしない）。省略に備えて title にも同じ全文を置く。
    expect(markup.match(/>Cor\. のサイトに戻る<\/span>/g)).toHaveLength(1);
    expect(markup).toContain('title="Cor. のサイトに戻る"');
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
    const header = second.slice(second.indexOf('<header id="app-header"'), second.indexOf('</header>'));
    expect(header).not.toContain('href="https://cor-jp.com/contact/chat/"');
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

describe('App header (one row, common shape)', () => {
  function renderHeader(search = ''): string {
    stubBrowser({ search });
    const markup = renderApp();
    const headerStart = markup.indexOf('<header id="app-header"');
    expect(headerStart, 'header is rendered').toBeGreaterThan(-1);
    return markup.slice(headerStart, markup.indexOf('</header>', headerStart));
  }

  function openingTagClass(markup: string, marker: string): string {
    const markerAt = markup.indexOf(marker);
    expect(markerAt, `${marker} is rendered`).toBeGreaterThan(-1);
    const tagStart = markup.lastIndexOf('<', markerAt);
    const tag = markup.slice(tagStart, markup.indexOf('>', markerAt) + 1);
    const classAttribute = tag.match(/class="([^"]*)"/);
    expect(classAttribute, 'the element has a class attribute').not.toBeNull();
    return classAttribute![1];
  }

  it('pins a sticky 56px / 64px one-row header with the common colors', () => {
    const header = renderHeader();
    const classes = openingTagClass(header, '<header id="app-header"').split(/\s+/);

    expect(classes).toContain('sticky');
    expect(classes).toContain('top-0');
    expect(classes).toContain('h-14');
    expect(classes).toContain('lg:h-16');
    expect(classes).toContain('bg-stone-50');
    expect(classes).toContain('border-stone-200');
    expect(classes).toContain('px-3');
    expect(classes).toContain('lg:px-6');
  });

  it('renders exactly one return link with a 44px tap target and 14px text', () => {
    const header = renderHeader();
    const anchors = header.match(/<a\b/g) ?? [];
    expect(anchors).toHaveLength(1);

    const classes = openingTagClass(header, 'data-testid="header-return"').split(/\s+/);
    expect(classes).toContain('min-h-11');
    expect(classes).toContain('min-w-11');
    expect(classes).toContain('text-sm');
    expect(classes).toContain('rounded-full');
  });

  it('keeps the title in the DOM and hides it visually below 1024px', () => {
    const header = renderHeader();
    const h1Start = header.indexOf('<h1');
    expect(h1Start, 'the header title is rendered').toBeGreaterThan(-1);
    const classes = openingTagClass(header, '<h1').split(/\s+/);

    expect(classes).toContain('sr-only');
    expect(classes).toContain('lg:not-sr-only');
    expect(classes).toContain('text-base');
    expect(classes).toContain('font-semibold');
    expect(header).toContain(translations.ja.title);
  });

  it('renders the logo outside any link', () => {
    const header = renderHeader();

    expect(header).toContain('data-testid="header-avatar"');
    expect(header).toMatch(/role="img"/);
    // 絵は link にしない。header の中の link は戻る 1 本だけ。
    expect(header.match(/<a\b/g) ?? []).toHaveLength(1);
    expect(header).not.toMatch(/<a\b[^>]*>[\s\S]*role="img"/);
  });

  it('keeps the language switch inside header-languages and out of the return link', () => {
    const header = renderHeader();
    const languagesStart = header.indexOf('data-testid="header-languages"');
    expect(languagesStart).toBeGreaterThan(-1);

    const languagesGroup = header.slice(languagesStart);
    expect(languagesGroup).toMatch(/<button[^>]*>English<\/button>/);
    expect(languagesGroup).toMatch(/<button[^>]*>日本語<\/button>/);
    expect(languagesGroup).toContain('aria-pressed="true"');
    expect(languagesGroup).toContain('aria-pressed="false"');
    const desktopClasses = (languagesGroup.match(/data-testid="header-languages" class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(desktopClasses).toContain('hidden');
    expect(desktopClasses).toContain('lg:block');
    expect(languagesGroup).toContain('lg:hidden');
  });

  it('has no mode link and no new-conversation button in the header', () => {
    const header = renderHeader('?intent=local-llm-poc');

    expect(header).not.toContain('Cloudiaと雑談する');
    expect(header).not.toContain('相談の受付へ戻る');
    expect(header).not.toContain('新しい相談');
    expect(header).not.toContain('href="/contact/chat/ambassador/"');
  });

  it('hides the header inside the embed frame', () => {
    stubBrowser({ search: '?embed=1' });
    const markup = renderApp();

    expect(markup).not.toContain('header-languages');
    expect(markup).not.toContain('app-header');
  });
});

describe('App new-conversation action', () => {
  it('sits at the top of the conversation section and not in the header', () => {
    stubBrowser({ search: '?intent=local-llm-poc' });
    const markup = renderApp();

    const sectionStart = markup.indexOf('<section');
    const actionsStart = markup.indexOf('data-testid="conversation-actions"');
    const logStart = markup.indexOf('role="log"');
    expect(actionsStart).toBeGreaterThan(sectionStart);
    expect(actionsStart).toBeLessThan(logStart);
    expect(markup).toContain('新しい相談');

    const headerStart = markup.indexOf('<header id="app-header"');
    const header = markup.slice(headerStart, markup.indexOf('</header>', headerStart));
    expect(header).not.toContain('新しい相談');
  });

  it('is absent until an intent is chosen', () => {
    stubBrowser({ search: '' });
    const markup = renderApp();

    expect(markup).not.toContain('conversation-actions');
  });

  it('uses the existing condition (selected intent, more than one message, or submitted)', () => {
    stubBrowser({ search: '?intent=local-llm-poc' });
    expect(renderApp()).toContain('conversation-actions');
  });
});

describe('App footer bar', () => {
  it('renders the footer landmark outside main and after it', () => {
    stubBrowser({ search: '' });
    const markup = renderApp();

    const mainEnd = markup.indexOf('</main>');
    const footerStart = markup.indexOf('<footer');
    expect(footerStart).toBeGreaterThan(mainEnd);
    expect(markup).toContain('data-testid="site-footer"');
    expect(markup).toContain('aria-label="共通リンク"');
    expect(markup).toContain('aria-label="サイト切替"');
  });

  it('hides the footer inside the embed frame', () => {
    stubBrowser({ search: '?embed=1' });
    const markup = renderApp();

    expect(markup).not.toContain('<footer');
    expect(markup).not.toContain('data-testid="site-footer"');
  });
});

describe('App embed mode', () => {
  it('hides the header and the return link inside the embed frame, but still shows the intro panel', () => {
    stubBrowser({ search: '?embed=1' });
    const markup = renderApp();

    expect(markup).toContain('data-embed="true"');
    expect(markup).not.toContain('app-header');
    expect(markup).not.toContain('のサイトに戻る');
    expect(markup).toContain(translations.ja.welcomeMessage);
    expect(markup).toContain('href="/contact/?source=footer-calendar#contact-calendar" target="_top"');
  });
});

describe('reception links', () => {
  it('offers booking availability and the mode switch as links after the first message and purpose choices', () => {
    for (const source of ['', '&source=industry-medical']) {
      stubBrowser({ search: '?locale=ja' + source });
      const markup = renderApp();
      expect(markup).toContain('href="/contact/?source=footer-calendar#contact-calendar"');
      expect(markup).toContain(translations.ja.introCalendarLink);
      expect(markup).toContain('href="/contact/chat/ambassador/?locale=ja');
      expect(markup).not.toContain('準備中');
      expect(markup.indexOf('data-testid="cloudia-intro-panel"')).toBeGreaterThan(markup.indexOf('</fieldset>'));
    }
  });
});

describe('industry entry first view', () => {
  it.each(INDUSTRY_ENTRY_SOURCES)('opens %s with its own one short question, not the generic greeting (ja)', (source) => {
    stubBrowser({ search: `?source=${source}` });
    const markup = renderApp();

    // 最初の Cloudia 発話は、この業態専用の問い 1 つ。
    expect(markup).toContain(industryQuestion(source, 'ja'));
    // 汎用の挨拶・他業態の問い・契約冒頭の業態ラベル文は出さない。
    expect(markup).not.toContain(translations.ja.welcomeMessage);
    for (const other of INDUSTRY_ENTRY_SOURCES) {
      if (other !== source) expect(markup, `${other} の問いが混ざっている`).not.toContain(industryQuestion(other, 'ja'));
    }
    expect(markup).not.toContain(industryGuidance(source).opening.ja);
    // 冒頭の業態固有のプライバシー境界と同意 link は 1 つ残す。
    expect(markup).toContain(industryPrivacyBoundary(source, 'ja'));
    expect(markup).toContain('href="/privacy/#ai-reception"');
    expect(markup).not.toContain(translations.ja.piiNotice);
    expect(markup).toContain(translations.ja.introCalendarLink);
    expect(markup).toContain(translations.ja.skipChatHandoff);
    // 目的選択は残す。
    expect(markup).toContain(translations.ja.intentPickerPrompt);
  });

  it.each(INDUSTRY_ENTRY_SOURCES)('opens %s with the English question and boundary in English', (source) => {
    stubBrowser({ search: `?locale=en&source=${source}` });
    const markup = renderApp();

    expect(markup).toContain(industryQuestion(source, 'en'));
    expect(markup).toContain(industryPrivacyBoundary(source, 'en'));
    expect(markup).not.toContain(translations.en.welcomeMessage);
    for (const other of INDUSTRY_ENTRY_SOURCES) {
      if (other !== source) expect(markup, `${other} の問いが混ざっている`).not.toContain(industryQuestion(other, 'en'));
    }
    expect(markup).not.toContain(industryGuidance(source).opening.en);
    expect(markup).toContain(translations.en.introCalendarLink);
    expect(markup).toContain(translations.en.skipChatHandoff);
  });

  it('uses the English question for zh, ko, and es (existing locale fallback)', () => {
    for (const siteLocale of ['zh', 'ko', 'es']) {
      stubBrowser({ search: `?locale=${siteLocale}&source=industry-education` });
      const markup = renderApp();
      expect(markup).toContain(industryQuestion('industry-education', 'en'));
      expect(markup).not.toContain(industryQuestion('industry-education', 'ja'));
    }
  });

  it('keeps the generic greeting and the generic notice for the general, launcher, and poisoned entries', () => {
    for (const search of [
      '',
      '?source=corsweb-launcher',
      '?source=corsweb-contact-primary',
      '?source=corsweb-launcher-fallback',
      '?source=industry-medical&source=industry-shigyo',
      '?source=industry-medical%20industry-shigyo',
    ]) {
      stubBrowser({ search });
      const markup = renderApp();
      expect(markup, `search "${search}"`).toContain(translations.ja.welcomeMessage);
      expect(markup, `search "${search}"`).toContain(translations.ja.piiNotice);
      expect(markup, `search "${search}"`).not.toContain(industryQuestion('industry-medical', 'ja'));
      expect(markup, `search "${search}"`).not.toContain(industryPrivacyBoundary('industry-medical', 'ja'));
      expect(markup, `search "${search}"`).not.toContain(translations.ja.skipChatHandoff);
    }
  });

  it('keeps the ambassador greeting when an industry source opens the ambassador mode', () => {
    stubBrowser({ search: '?mode=ambassador&source=industry-medical' });
    const markup = renderApp();

    expect(markup).toContain(translations.ja.welcomeMessageAmbassador);
    expect(markup).not.toContain(industryQuestion('industry-medical', 'ja'));
    expect(markup).not.toContain(translations.ja.intentPickerPrompt);
  });

  it('enables the input from the first paint with a short, clear label', () => {
    for (const search of ['', '?source=industry-medical']) {
      stubBrowser({ search });
      const markup = renderApp();
      const input = markup.match(/<input[^>]*>/)?.[0] ?? '';
      expect(input, `search "${search}"`).not.toContain('disabled=""');
      expect(input, `search "${search}"`).toContain('placeholder="ご相談を入力"');
      expect(input, `search "${search}"`).toContain('aria-label="ご相談を入力"');
    }
  });

  it('does not repeat the purpose-selection instruction in the greeting', () => {
    expect(translations.ja.welcomeMessage).not.toContain('目的を選んでください。');
    expect(translations.en.welcomeMessage).not.toContain('choose the purpose');
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
