import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SiteFooterBar from './SiteFooterBar';
import { LanguageProvider } from '../contexts/LanguageContext';
import { SITE_CHROME } from '../constants/siteChrome';

function stubBrowser(search = '') {
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
}

function renderFooter(locale: 'ja' | 'en' = 'ja'): string {
  stubBrowser(locale === 'en' ? '?locale=en' : '');
  return renderToStaticMarkup(
    <LanguageProvider>
      <SiteFooterBar currentSite="cloudia" now={new Date('2026-05-01T00:00:00Z')} />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SiteFooterBar', () => {
  it('renders a footer landmark with two labelled navs', () => {
    const markup = renderFooter('ja');

    expect(markup).toContain('<footer');
    expect(markup).toContain('aria-label="共通リンク"');
    expect(markup).toContain('aria-label="サイト切替"');
    expect(markup).toContain(`© 2026 ${SITE_CHROME.organization.ja}`);
  });

  it('marks Cloudia as the current site', () => {
    const markup = renderFooter('ja');
    const cloudia = markup.match(/<a[^>]*aria-current="page"[^>]*>Cloudia<\/a>/);

    expect(cloudia).not.toBeNull();
    expect((markup.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
    expect(cloudia![0]).toContain('font-bold');
    expect(cloudia![0]).toContain('text-stone-900');
  });

  it('renders the three common links in the JSON order with Japanese labels and hrefs', () => {
    const markup = renderFooter('ja');
    let last = -1;

    for (const link of SITE_CHROME.commonLinks) {
      const at = markup.indexOf(link.label.ja);
      expect(at, link.id).toBeGreaterThan(last);
      expect(markup).toContain(`href="${link.href.ja}"`);
      last = at;
    }
    expect(markup).not.toContain('利用規約');
  });

  it('renders the English labels and hrefs', () => {
    const markup = renderFooter('en');

    expect(markup).toContain(`© 2026 ${SITE_CHROME.organization.en}`);
    expect(markup).toContain('aria-label="Common links"');
    expect(markup).toContain('aria-label="Sites"');
    for (const link of SITE_CHROME.commonLinks) {
      expect(markup).toContain(link.label.en);
      expect(markup).toContain(`href="${link.href.en}"`);
    }
  });

  it('puts rel="noopener" on every link in the bar', () => {
    const markup = renderFooter('ja');
    const anchors = markup.match(/<a\b[^>]*>/g) ?? [];

    expect(anchors).toHaveLength(SITE_CHROME.commonLinks.length + SITE_CHROME.sites.length);
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="noopener"');
    }
  });

  it('pins the 64px desktop row and the vertical narrow layout', () => {
    const markup = renderFooter('ja');

    expect(markup).toContain('lg:h-16');
    expect(markup).toContain('flex-col');
    expect(markup).toContain('lg:flex-row');
    expect(markup).toContain('py-4');
    expect(markup).toContain('lg:py-0');
  });
});
