import { describe, expect, it } from 'vitest';
import { showDirectHandoff, showIndustryEntryPanel, showReadyHandoff, type InquiryPathInput } from './inquiryPath';

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

describe('inquiry path', () => {
  it.each(['genuine', 'sales', 'spam'] as const)(
    'still offers the contact form when classification is %s',
    (classification) => {
      expect(showDirectHandoff(path({ classification }))).toBe(true);
      expect(showReadyHandoff(path({ classification, readyForContact: true }))).toBe(true);
    },
  );

  it('uses the ready step once the chat has enough, and the direct step before that', () => {
    expect(showDirectHandoff(path({ readyForContact: true }))).toBe(false);
    expect(showReadyHandoff(path({ readyForContact: true }))).toBe(true);
    expect(showDirectHandoff(path({ readyForContact: false }))).toBe(true);
    expect(showReadyHandoff(path({ readyForContact: false }))).toBe(false);
  });

  it('hides both once the inquiry was sent, the form is open, or the question was resolved', () => {
    for (const overrides of [{ submitted: true }, { showHandoff: true }, { faqResolved: true }] as const) {
      expect(showDirectHandoff(path(overrides))).toBe(false);
      expect(showReadyHandoff(path({ ...overrides, readyForContact: true }))).toBe(false);
    }
  });

  it('does not offer the direct form in the ambassador conversation', () => {
    expect(showDirectHandoff(path({ appMode: 'ambassador' }))).toBe(false);
  });
});

describe('showIndustryEntryPanel', () => {
  const base = { appMode: 'intake' as const, submitted: false, showHandoff: false, faqResolved: false };

  it('shows the panel only for an industry entry in intake mode', () => {
    expect(showIndustryEntryPanel({ ...base, industryEntry: true })).toBe(true);
    expect(showIndustryEntryPanel({ ...base, industryEntry: false })).toBe(false);
    expect(showIndustryEntryPanel({ ...base, appMode: 'ambassador', industryEntry: true })).toBe(false);
  });

  it('hides the panel once the form is open, the inquiry is sent, or the FAQ answered it', () => {
    expect(showIndustryEntryPanel({ ...base, industryEntry: true, showHandoff: true })).toBe(false);
    expect(showIndustryEntryPanel({ ...base, industryEntry: true, submitted: true })).toBe(false);
    expect(showIndustryEntryPanel({ ...base, industryEntry: true, faqResolved: true })).toBe(false);
  });
});
