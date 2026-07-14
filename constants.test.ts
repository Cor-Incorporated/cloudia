import { describe, expect, it } from 'vitest';
import { getSystemInstruction } from './constants';
import { translations } from './translations';

describe('Cloudia company naming', () => {
  it('keeps the regular and ambassador greetings short', () => {
    for (const locale of ['ja', 'en'] as const) {
      expect(translations[locale].welcomeMessage).not.toContain('コー株式会社');
      expect(translations[locale].welcomeMessageAmbassador).not.toContain('コー株式会社');
      expect(translations[locale].welcomeMessage).not.toContain('Cor.inc');
      expect(translations[locale].welcomeMessageAmbassador).not.toContain('Cor.inc');
    }
  });

  it('defers the legal-name explanation until a visitor asks', () => {
    const intake = getSystemInstruction('ja', 'intake');
    const ambassador = getSystemInstruction('ja', 'ambassador');
    for (const instruction of [intake, ambassador]) {
      expect(instruction).toContain('Do not volunteer the Japanese legal name');
      expect(instruction).toContain('read as コー株式会社');
      expect(instruction).toContain('If the visitor asks how the company name is read');
    }
  });
});
