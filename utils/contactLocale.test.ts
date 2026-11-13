import { describe, expect, it } from 'vitest';
import { INDUSTRY_ENTRY_SOURCES } from '../constants/entrySources';
import { industryContextLine, industryLabel } from '../constants/industryGuidance';
import { CONTACT_INTENT_DISPLAY_OPTIONS, getIntentDisplayLabel } from '../constants/intents';
import { translations, type Locale } from '../translations';
import { showDirectHandoff, type InquiryPathInput } from './inquiryPath';
import { CONTACT_LOCALES, resolveUiLocale } from './contactLocale';

const UNSUPPORTED = ['zh', 'ko', 'es', 'zh-CN', 'ko-KR', 'es-ES', 'en-US', 'fr', ''] as const;

const RECEPTION_KEYS = [
  'welcomeMessage',
  'intentPickerPrompt',
  'handoffTitle',
  'handoffName',
  'handoffEmail',
  'handoffSubmit',
  'skipChatHandoff',
  'unavailableExtensions',
  'fallbackNotice',
  'retry',
  'aiError',
  'showHandoff',
] as const;

function path(overrides: Partial<InquiryPathInput> = {}): InquiryPathInput {
  return {
    appMode: 'intake',
    submitted: false,
    showHandoff: false,
    readyForContact: false,
    faqResolved: false,
    showFaqPrompt: false,
    classification: 'genuine',
    ...overrides,
  };
}

describe('contact locales', () => {
  it('offers ja and en only', () => {
    expect(CONTACT_LOCALES).toEqual(['ja', 'en']);
    expect(Object.keys(translations).sort()).toEqual(['en', 'ja']);
  });

  it.each(UNSUPPORTED)('resolves query %s to English when nothing else is stored', (query) => {
    expect(resolveUiLocale({ query, stored: null, browserLanguage: null })).toBe('en');
    expect(resolveUiLocale({ query, stored: null, browserLanguage: query })).toBe('en');
  });

  it('keeps an exact ja or en query, and a stored or browser ja, ahead of an unsupported query', () => {
    expect(resolveUiLocale({ query: 'ja', stored: 'en', browserLanguage: 'zh-CN' })).toBe('ja');
    expect(resolveUiLocale({ query: 'en', stored: 'ja', browserLanguage: 'ko' })).toBe('en');
    expect(resolveUiLocale({ query: 'zh', stored: 'ja', browserLanguage: 'es' })).toBe('ja');
    expect(resolveUiLocale({ query: 'ko', stored: null, browserLanguage: 'ja-JP' })).toBe('ja');
    expect(resolveUiLocale({ query: null, stored: 'en', browserLanguage: 'zh' })).toBe('en');
  });

  it('shows English industry guidance, purpose choices, and the contact form for zh, ko, and es', () => {
    for (const query of ['zh', 'ko', 'es'] as const) {
      const locale = resolveUiLocale({ query, stored: null, browserLanguage: query });
      expect(locale).toBe('en');
      for (const source of INDUSTRY_ENTRY_SOURCES) {
        const line = industryContextLine(source, query);
        expect(line).toBe(industryContextLine(source, 'en'));
        expect(line).toBeTruthy();
        expect(line).not.toContain('undefined');
        expect(industryLabel(source, query)).toBe(industryLabel(source, 'en'));
      }
      for (const key of RECEPTION_KEYS) {
        const text = translations[locale][key];
        expect(text.length).toBeGreaterThan(1);
        expect(text).not.toBe(key);
      }
      for (const option of CONTACT_INTENT_DISPLAY_OPTIONS) {
        const label = getIntentDisplayLabel(option.primaryIntent, locale);
        expect(label).toBe(option.label.en);
        expect(label.length).toBeGreaterThan(1);
      }
      expect(showDirectHandoff(path())).toBe(true);
      expect(translations[locale].unavailableExtensions).toContain('not available');
    }
  });

  it('still offers the contact form when the model has not accepted the conversation', () => {
    for (const locale of CONTACT_LOCALES) {
      expect(translations[locale].fallbackNotice.length).toBeGreaterThan(1);
      expect(translations[locale].retry.length).toBeGreaterThan(1);
      expect(translations[locale].handoffSubmit.length).toBeGreaterThan(1);
    }
    expect(showDirectHandoff(path({ readyForContact: false, classification: 'sales' }))).toBe(true);
    expect(showDirectHandoff(path({ readyForContact: false, classification: 'genuine' }))).toBe(true);
    const fallback: Locale = resolveUiLocale({ query: 'zh', stored: null, browserLanguage: 'ko' });
    expect(translations[fallback].aiError).toContain('try again');
  });
});

describe('resolveUiLocale with a stored value', () => {
  it.each(['zh', 'ko', 'es', 'en-US', 'fr', ''])('ignores a stored %j that is not a language of this UI', (stored) => {
    expect(resolveUiLocale({ query: null, stored, browserLanguage: null })).toBe('en');
    expect(resolveUiLocale({ query: null, stored, browserLanguage: 'ja-JP' })).toBe('ja');
  });
});
