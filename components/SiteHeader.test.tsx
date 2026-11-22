import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SiteHeader from './SiteHeader';
import { LanguageProvider } from '../contexts/LanguageContext';
import { Emotion } from '../types';
import { translations } from '../translations';

function stubBrowser(search = '') {
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
}

function renderHeader(props: { search?: string; returnHref?: string | null; returnLabel?: string | null; contentHasHeading?: boolean } = {}): string {
  stubBrowser(props.search ?? '');
  return renderToStaticMarkup(
    <LanguageProvider>
      <SiteHeader
        emotion={Emotion.ENJOYING}
        returnHref={props.returnHref === undefined ? 'https://cor-jp.com/' : props.returnHref}
        returnLabel={props.returnLabel === undefined ? translations.ja.backToCorSite : props.returnLabel}
        locale="ja"
        onSelectLocale={() => undefined}
        contentHasHeading={props.contentHasHeading}
      />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SiteHeader', () => {
  it('pins the sticky one-row header at 56px / 64px', () => {
    const markup = renderHeader();
    const start = markup.indexOf('<header');
    const tag = markup.slice(start, markup.indexOf('>', start) + 1);
    const classes = (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);

    expect(classes).toContain('sticky');
    expect(classes).toContain('top-0');
    expect(classes).toContain('h-14');
    expect(classes).toContain('lg:h-16');
    expect(classes).toContain('items-center');
    expect(classes).not.toContain('flex-wrap');
    expect(classes).not.toContain('py-2');
  });

  it('renders one return link with a 44px target and the arrow out of the readable name', () => {
    const markup = renderHeader();
    expect(markup.match(/data-testid="header-return"/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/aria-hidden="true"[^>]*>←<\/span>/);
    expect(markup).toContain('Cor. のサイトに戻る');

    const classes = (markup.match(/data-testid="header-return"[^>]*class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(classes).toContain('min-h-11');
    expect(classes).toContain('min-w-11');
    expect(classes).toContain('text-sm');
  });

  it('orders the right group as desktop language, return link, narrow language in the DOM', () => {
    const markup = renderHeader();
    const desktopLanguage = markup.indexOf('data-testid="header-languages"');
    const returnLink = markup.indexOf('data-testid="header-return"');
    const narrowLanguage = markup.lastIndexOf('data-testid="header-languages"');

    expect(desktopLanguage).toBeGreaterThan(-1);
    expect(returnLink).toBeGreaterThan(desktopLanguage);
    expect(narrowLanguage).toBeGreaterThan(returnLink);
  });

  it('shows the short return label on narrow screens and keeps the full accessible name', () => {
    const markup = renderHeader();
    const linkClasses = (markup.match(/data-testid="header-return"[^>]*class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(linkClasses).not.toContain('min-w-0');
    expect(linkClasses).toContain('overflow-hidden');
    expect(linkClasses).toContain('min-h-11');
    expect(linkClasses).toContain('min-w-11');

    expect(markup).toContain(`lg:hidden">${translations.ja.backShort}</span>`);
    expect(markup).toContain(`lg:inline">${translations.ja.backToCorSite}</span>`);
    expect(markup).toContain(`title="${translations.ja.backToCorSite}"`);
    expect(markup).toContain(`aria-label="${translations.ja.backToCorSite}"`);
  });

  it('keeps the title in the DOM, visually hidden below 1024px', () => {
    const markup = renderHeader();
    const h1 = markup.slice(markup.indexOf('<h1'), markup.indexOf('</h1>') + 5);
    expect(h1).toContain(translations.ja.title);
    const classes = (h1.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(classes).toContain('sr-only');
    expect(classes).toContain('lg:not-sr-only');
  });

  it('keeps the brand title as text when the main content provides the heading', () => {
    const markup = renderHeader({ contentHasHeading: true });
    expect(markup).not.toContain('<h1');
    expect(markup).toContain(`>${translations.ja.title}</p>`);
  });

  it('does not turn the logo into a link', () => {
    const markup = renderHeader();

    // 絵は link にしない。link は戻る 1 本だけ。
    expect(markup.match(/<a\b/g) ?? []).toHaveLength(1);
    expect(markup).not.toMatch(/<a\b[^>]*>[\s\S]*role="img"/);
  });

  it('shows the logo even when there is no return link', () => {
    const markup = renderHeader({ returnHref: null, returnLabel: null });

    expect(markup).toContain('role="img"');
    expect(markup).not.toContain('data-testid="header-return"');
    expect(markup.match(/<a\b/g) ?? []).toHaveLength(0);
  });
});
