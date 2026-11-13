import { describe, expect, it } from 'vitest';
import { showDirectHandoff, showReadyHandoff, type InquiryPathInput } from './inquiryPath';

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
