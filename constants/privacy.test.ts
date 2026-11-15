import { describe, expect, it } from 'vitest';
import { translations, type Locale } from '../translations';
import { PRIVACY_AI_RECEPTION_ANCHOR, PRIVACY_POLICY_PATHS, privacyPolicyHref } from './privacy';

describe('privacyPolicyHref', () => {
  it('points each UI language at its own policy page and the AI reception section', () => {
    expect(privacyPolicyHref('ja')).toBe('/privacy/#ai-reception');
    expect(privacyPolicyHref('en')).toBe('/en/privacy/#ai-reception');
  });

  it('has a policy page for every UI language', () => {
    const locales = Object.keys(translations) as Locale[];
    expect(Object.keys(PRIVACY_POLICY_PATHS).sort()).toEqual([...locales].sort());
    for (const locale of locales) {
      expect(PRIVACY_POLICY_PATHS[locale]).toMatch(/^\/(?:[a-z]{2}\/)?privacy\/$/);
    }
  });

  it('uses an anchor that is a plain HTML id', () => {
    expect(PRIVACY_AI_RECEPTION_ANCHOR).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});

describe('translations', () => {
  it('has the same keys in English and Japanese, none of them empty', () => {
    const en = translations.en as Record<string, string>;
    const ja = translations.ja as Record<string, string>;
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(en[key], `en.${key}`).not.toBe('');
      expect(ja[key], `ja.${key}`).not.toBe('');
    }
  });
});
