import { describe, expect, it } from 'vitest';
import { resolveLaunchContext, syncHtmlLang } from './launchContext';

describe('resolveLaunchContext', () => {
  it.each([
    'contract-dev',
    'grift-team-beta',
    'grift-paid-trial',
    'estimate-audit',
  ] as const)('normalizes source/locale/embed while preserving Grift intent %s', (intent) => {
    expect(resolveLaunchContext(
      `?source=%20Header-AI-Dev%20&locale=ja&embed=1&intent=${intent}`,
      'en',
    )).toEqual({
      source: 'header-ai-dev',
      locale: 'ja',
      embed: true,
      intent,
    });
  });

  it('falls back safely for malformed launch parameters', () => {
    expect(resolveLaunchContext(
      '?source=https%3A%2F%2Fevil.example&locale=fr&embed=yes&intent=unknown',
      'en',
    )).toEqual({
      source: 'cloudia',
      locale: 'en',
      embed: false,
      intent: null,
    });
  });

  it('keeps the html language in sync with the normalized locale', () => {
    const root = { lang: 'en' };
    syncHtmlLang(root, 'ja');
    expect(root.lang).toBe('ja');
    syncHtmlLang(root, 'fr');
    expect(root.lang).toBe('en');
  });
});
