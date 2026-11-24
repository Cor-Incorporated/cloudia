import { describe, expect, it } from 'vitest';
import { Emotion, type Message } from '../types';
import {
  chatPlaceholderKey,
  displayThread,
  handoffSuccessMessage,
  messageListScrollTarget,
  showNewConversation,
} from './chatView';

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
  it('labels the input shortly by mode, without explaining what to do first', () => {
    expect(chatPlaceholderKey('intake')).toBe('typeYourMessageIntake');
    expect(chatPlaceholderKey('ambassador')).toBe('typeYourMessage');
  });
});

describe('displayThread', () => {
  const opening: Message = { id: 'opening', text: 'こんにちは。汎用の挨拶です。', sender: 'ai', emotion: Emotion.ENJOYING };
  const QUESTION = '紹介状の下書きや看護サマリーの整理など、まず、どんなことをしたいとお考えですか。';

  it('swaps the opening bubble for the industry question before the conversation starts', () => {
    const thread = displayThread([opening], { openingText: QUESTION, dropOpening: false });
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ id: 'opening', sender: 'ai', text: QUESTION });
  });

  it('drops the opening bubble once the conversation has started, so nothing sits beside the reply', () => {
    const reception = { ...opening, id: 'reception', text: '医療のページから開いています。…' };
    const user = { id: 'u1', text: '紹介状の下書きです。', sender: 'user' as const };
    const thread = displayThread([opening, reception, user], { openingText: QUESTION, dropOpening: true });
    expect(thread.map((m) => m.id)).toEqual(['reception', 'u1']);
    expect(thread.some((m) => m.text === 'こんにちは。汎用の挨拶です。')).toBe(false);
  });

  it('keeps the thread as it is for the general entry and for a user-first thread', () => {
    expect(displayThread([opening], { openingText: null, dropOpening: false })).toEqual([opening]);
    expect(displayThread([opening], { openingText: null, dropOpening: true })).toEqual([opening]);
    const userFirst = [{ id: 'u1', text: '相談です。', sender: 'user' as const }];
    expect(displayThread(userFirst, { openingText: QUESTION, dropOpening: false })).toEqual(userFirst);
    expect(displayThread([], { openingText: QUESTION, dropOpening: true })).toEqual([]);
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

describe('showNewConversation', () => {
  it('shows on each of the three sides alone', () => {
    expect(showNewConversation({ selectedIntent: 'local-llm-poc', messageCount: 1, submitted: false })).toBe(true);
    expect(showNewConversation({ selectedIntent: null, messageCount: 2, submitted: false })).toBe(true);
    expect(showNewConversation({ selectedIntent: null, messageCount: 1, submitted: true })).toBe(true);
  });

  it('hides when all three sides are false', () => {
    expect(showNewConversation({ selectedIntent: null, messageCount: 1, submitted: false })).toBe(false);
    expect(showNewConversation({ selectedIntent: null, messageCount: 0, submitted: false })).toBe(false);
  });

  it('shows when any two sides are true', () => {
    expect(showNewConversation({ selectedIntent: 'local-llm-poc', messageCount: 2, submitted: false })).toBe(true);
    expect(showNewConversation({ selectedIntent: 'local-llm-poc', messageCount: 1, submitted: true })).toBe(true);
    expect(showNewConversation({ selectedIntent: null, messageCount: 2, submitted: true })).toBe(true);
    expect(showNewConversation({ selectedIntent: 'local-llm-poc', messageCount: 2, submitted: true })).toBe(true);
  });
});
