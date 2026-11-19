import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LanguageMenu, {
  LanguageMenuPanel,
  LanguageSwitch,
  isEscapeKey,
  isOutsidePointer,
  languageMenuReducer,
  shouldCloseOnBlur,
} from './LanguageMenu';
import { LanguageProvider } from '../contexts/LanguageContext';

/** 言語の wrap の class 属性だけを取り出す（aria-hidden と取り違えない）。 */
function classTokens(markup: string): string[] {
  const tag = markup.match(/<div[^>]*data-testid="header-languages"[^>]*>/)?.[0] ?? '';
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
}

function stubBrowser(search = '') {
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
}

function renderMenu(locale: 'ja' | 'en' = 'ja'): string {
  stubBrowser();
  return renderToStaticMarkup(
    <LanguageProvider>
      <LanguageMenu locale={locale} onSelectLocale={() => undefined} />
    </LanguageProvider>,
  );
}

function renderSwitch(locale: 'ja' | 'en' = 'ja'): string {
  stubBrowser();
  return renderToStaticMarkup(
    <LanguageProvider>
      <LanguageSwitch locale={locale} onSelectLocale={() => undefined} />
    </LanguageProvider>,
  );
}

function renderPanel(locale: 'ja' | 'en' = 'ja', id?: string): string {
  stubBrowser();
  return renderToStaticMarkup(
    <LanguageProvider>
      <LanguageMenuPanel id={id} locale={locale} onSelect={() => undefined} />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LanguageMenu', () => {
  it('renders the desktop disclosure button closed, with aria-expanded and aria-controls', () => {
    const markup = renderMenu('ja');

    expect(markup).toMatch(/aria-expanded="false"/);
    expect(markup).toMatch(/aria-controls="[^"]+"/);
    expect(markup).not.toMatch(/aria-haspopup/);
    expect(markup).not.toContain('role="menu"');
    expect(classTokens(markup)).toContain('hidden');
    expect(classTokens(markup)).toContain('lg:block');
    expect(classTokens(markup)).not.toContain('lg:hidden');
    expect(markup).not.toContain('data-testid="language-menu"');
    expect(markup).toContain('🇯🇵');
    expect(markup).toContain('>JA<');
    expect(markup).toContain('▾');
  });

  it('names the button with the visible short name after the label', () => {
    expect(renderMenu('ja')).toContain('aria-label="言語を切り替え: JA"');
    expect(renderMenu('en')).toContain('aria-label="言語を切り替え: EN"');
  });

  it('renders the two narrow buttons with aria-pressed for the current locale', () => {
    const markup = renderSwitch('en');

    expect(markup).toMatch(/<button[^>]*aria-pressed="true"[^>]*>English<\/button>/);
    expect(markup).toMatch(/<button[^>]*aria-pressed="false"[^>]*>日本語<\/button>/);
    expect(markup).toContain('role="group"');
    expect(markup).toContain('lg:hidden');

    const englishClasses = (markup.match(/<button[^>]*aria-pressed="true"[^>]*class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(englishClasses).toContain('min-h-11');
    expect(englishClasses).toContain('min-w-11');
    expect(englishClasses).toContain('text-xs');
    expect(englishClasses).toContain('border-navy');
  });

  it('renders the open panel as a disclosure body with two pressed choices, not a menu', () => {
    const markup = renderPanel('ja', 'lang-panel');

    expect(markup).toContain('id="lang-panel"');
    expect(markup).not.toContain('role="menu"');
    expect(markup).not.toContain('role="menuitemradio"');
    expect(markup).not.toContain('aria-checked');
    expect(markup.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*>[\s\S]*?日本語/);
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>[\s\S]*?English/);
  });

  it('does not mistake aria-hidden="true" for the hidden class', () => {
    const markup = '<div data-testid="header-languages" aria-hidden="true"></div>';

    // 文字列全体を見る前の検査なら aria-hidden でも通ってしまう。
    expect(markup).toContain('hidden');
    // class 属性だけを見ると hidden は無い。
    expect(classTokens(markup)).not.toContain('hidden');
  });

  it('decides open, Escape/outside close, blur-out, and select in the reducer', () => {
    expect(languageMenuReducer({ open: false }, { type: 'toggle' })).toEqual({ open: true });
    expect(languageMenuReducer({ open: true }, { type: 'toggle' })).toEqual({ open: false });
    expect(languageMenuReducer({ open: true }, { type: 'close' })).toEqual({ open: false });
    expect(languageMenuReducer({ open: true }, { type: 'blur-out' })).toEqual({ open: false });
    expect(languageMenuReducer({ open: true }, { type: 'select', locale: 'en' })).toEqual({
      open: false,
      selected: 'en',
    });
  });
});

describe('LanguageMenu decisions', () => {
  const inside = { id: 'inside' } as unknown as Node;
  const outside = { id: 'outside' } as unknown as Node;
  const container = {
    contains(node: Node | null): boolean {
      return node === inside;
    },
  };

  it('closes on blur only when focus leaves the container', () => {
    expect(shouldCloseOnBlur(inside, container)).toBe(false);
    expect(shouldCloseOnBlur(outside, container)).toBe(true);
    expect(shouldCloseOnBlur(null, container)).toBe(true);
    expect(shouldCloseOnBlur(inside, null)).toBe(false);
    expect(shouldCloseOnBlur(outside, null)).toBe(false);
    expect(shouldCloseOnBlur(null, null)).toBe(false);
  });

  it('treats a pointer outside the container as outside', () => {
    expect(isOutsidePointer(inside, container)).toBe(false);
    expect(isOutsidePointer(outside, container)).toBe(true);
    expect(isOutsidePointer(null, container)).toBe(true);
    expect(isOutsidePointer(inside, null)).toBe(false);
    expect(isOutsidePointer(outside, null)).toBe(false);
    expect(isOutsidePointer(null, null)).toBe(false);
  });

  it('recognizes only the Escape key', () => {
    expect(isEscapeKey('Escape')).toBe(true);
    expect(isEscapeKey('Esc')).toBe(false);
    expect(isEscapeKey('escape')).toBe(false);
    expect(isEscapeKey('Enter')).toBe(false);
    expect(isEscapeKey('')).toBe(false);
  });
});
