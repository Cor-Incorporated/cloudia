import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import TurnstileWidget, {
  TURNSTILE_SCRIPT_URL,
  isOfficialTurnstileScriptUrl,
  normalizeTurnstileSiteKey,
  normalizeTurnstileToken,
} from './TurnstileWidget';

function installLocale(locale: 'ja' | 'en'): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { search: `?locale=${locale}` } },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: `${locale}-${locale === 'ja' ? 'JP' : 'US'}` },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined },
  });
}

describe('TurnstileWidget', () => {
  it('pins loading to the official explicit-render script URL only', () => {
    expect(TURNSTILE_SCRIPT_URL).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );
    expect(isOfficialTurnstileScriptUrl(TURNSTILE_SCRIPT_URL)).toBe(true);
    expect(isOfficialTurnstileScriptUrl(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=ready',
    )).toBe(true);
    expect(isOfficialTurnstileScriptUrl(
      'https://turnstile.example.com/turnstile/v0/api.js?render=explicit',
    )).toBe(false);
    expect(isOfficialTurnstileScriptUrl(
      'https://challenges.cloudflare.com.evil.example/turnstile/v0/api.js?render=explicit',
    )).toBe(false);
    expect(isOfficialTurnstileScriptUrl(
      'https://challenges.cloudflare.com/turnstile/v0/api.js',
    )).toBe(false);
  });

  it('normalizes the public sitekey and accepts only bounded callback tokens', () => {
    expect(normalizeTurnstileSiteKey('  public-site-key  ')).toBe('public-site-key');
    expect(normalizeTurnstileSiteKey(undefined)).toBe('');
    expect(normalizeTurnstileToken('  callback-token  ')).toBe('callback-token');
    expect(normalizeTurnstileToken('')).toBeNull();
    expect(normalizeTurnstileToken('x'.repeat(2048))).toHaveLength(2048);
    expect(normalizeTurnstileToken('x'.repeat(2049))).toBeNull();
  });

  it.each([
    ['en', 'Security check', 'Loading the security check.'],
    ['ja', 'セキュリティ確認', 'セキュリティ確認を読み込んでいます。'],
  ] as const)('renders an accessible %s loading status', (locale, label, status) => {
    installLocale(locale);
    const markup = renderToStaticMarkup(
      <LanguageProvider>
        <TurnstileWidget
          siteKey="public-site-key"
          resetSignal={0}
          onTokenChange={() => undefined}
        />
      </LanguageProvider>,
    );

    expect(markup).toContain(label);
    expect(markup).toContain(status);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});
