import { describe, expect, it } from 'vitest';
import { chatPlaceholderKey, handoffSuccessMessage, messageListScrollTarget } from './chatView';

describe('messageListScrollTarget', () => {
  it('keeps the greeting visible while it is the only message', () => {
    expect(messageListScrollTarget(1, false, false)).toBe('top');
    // "New inquiry" and a language switch reset the list to the greeting alone.
    expect(messageListScrollTarget(0, false, false)).toBe('top');
  });

  it('follows the conversation once it has started or something is loading', () => {
    expect(messageListScrollTarget(2, false, false)).toBe('bottom');
    expect(messageListScrollTarget(1, true, false)).toBe('bottom');
    expect(messageListScrollTarget(1, false, true)).toBe('bottom');
  });
});

describe('chatPlaceholderKey', () => {
  it('asks for a purpose first while none is chosen', () => {
    expect(chatPlaceholderKey('intake', false, false, null)).toBe('typeYourMessageChooseIntent');
  });

  it('does not ask for a purpose again after one was chosen, even if starting failed', () => {
    expect(chatPlaceholderKey('intake', false, false, 'local-llm-poc')).toBe('typeYourMessageIntake');
  });

  it('uses the usual placeholders while starting, once ready, and in ambassador mode', () => {
    expect(chatPlaceholderKey('intake', false, true, 'local-llm-poc')).toBe('typeYourMessageIntake');
    expect(chatPlaceholderKey('intake', true, false, 'local-llm-poc')).toBe('typeYourMessageIntake');
    expect(chatPlaceholderKey('ambassador', true, false, null)).toBe('typeYourMessage');
  });
});

describe('handoffSuccessMessage', () => {
  it('mentions the receipt number only when the Worker returned one', () => {
    expect(handoffSuccessMessage('COR-20261026-1A2B3C4D')).toEqual({
      textKey: 'handoffSuccessWithReceipt',
      replacements: { receiptId: 'COR-20261026-1A2B3C4D' },
    });
  });

  it('falls back to the plain message without a receipt number', () => {
    expect(handoffSuccessMessage(undefined)).toEqual({ textKey: 'handoffSuccess' });
    expect(handoffSuccessMessage('')).toEqual({ textKey: 'handoffSuccess' });
  });
});
