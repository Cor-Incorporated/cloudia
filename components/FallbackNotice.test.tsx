import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FallbackNotice from './FallbackNotice';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderNotice(onRetry?: () => void): string {
  vi.stubGlobal('window', { location: { search: '' } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <FallbackNotice visible onRetry={onRetry} />
    </LanguageProvider>,
  );
}

describe('FallbackNotice', () => {
  it('offers a retry and no link to a contact form that does not exist', () => {
    const markup = renderNotice(() => undefined);

    expect(markup).toContain('AI受付に一時的につながりません');
    expect(markup).toContain('もう一度試す');
    // cor-jp.com keeps no contact form; /contact/ only reopens this chat (corsweb #352).
    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('フォーム');
  });

  it('still explains the outage when there is nothing to retry', () => {
    const markup = renderNotice();

    expect(markup).toContain('AI受付に一時的につながりません');
    expect(markup).not.toContain('<button');
  });
});
