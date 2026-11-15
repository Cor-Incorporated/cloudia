import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PiiNotice from './PiiNotice';
import { LanguageProvider } from '../contexts/LanguageContext';
import { translations } from '../translations';

function renderNotice(browserLanguage: string): string {
  vi.stubGlobal('window', { location: { search: '' } });
  vi.stubGlobal('navigator', { language: browserLanguage });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <PiiNotice />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PiiNotice', () => {
  it('keeps the notice and adds a link to the Japanese privacy policy', () => {
    const markup = renderNotice('ja-JP');

    expect(markup).toContain(translations.ja.piiNotice);
    expect(markup).toContain('href="/privacy/#ai-reception"');
    expect(markup).toContain('個人情報の取扱いについては');
    expect(markup).toMatch(/>プライバシーポリシー<span class="sr-only">（新しいタブで開きます）<\/span><\/a>をご確認ください。/);
  });

  it('links to the English policy in English', () => {
    const markup = renderNotice('en-US');

    expect(markup).toContain(translations.en.piiNotice);
    expect(markup).toContain('href="/en/privacy/#ai-reception"');
    expect(markup).toMatch(/>Privacy Policy<span class="sr-only"> \(opens in a new tab\)<\/span><\/a>\./);
  });

  it('opens the policy in a new tab without giving it the opener', () => {
    const markup = renderNotice('ja-JP');

    expect(markup).toMatch(/<a href="\/privacy\/#ai-reception" target="_blank" rel="noopener noreferrer"/);
  });
});
