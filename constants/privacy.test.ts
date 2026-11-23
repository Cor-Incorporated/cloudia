import { describe, expect, it } from 'vitest';
import { translations } from '../translations';
import { PRIVACY_AI_RECEPTION_ANCHOR, privacyPolicyHref } from './privacy';

describe('privacyPolicyHref', () => {
  it('points each UI language at its own policy page and the AI reception section', () => {
    expect(privacyPolicyHref('ja')).toBe('https://cor-jp.com/privacy/#ai-reception');
    expect(privacyPolicyHref('en')).toBe('https://cor-jp.com/en/privacy/#ai-reception');
  });

  it.each(['zh', 'ko', 'es'])('opens the policy in the original %s language from a standalone page', (lang) => {
    expect(privacyPolicyHref('en', '?locale=' + lang)).toBe('https://cor-jp.com/' + lang + '/privacy/#ai-reception');
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
