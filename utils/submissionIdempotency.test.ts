import { describe, expect, it, vi } from 'vitest';
import {
  forgetSubmissionIdempotencyKey,
  getOrCreateHandoffConsentAcceptedAt,
  getOrCreateSubmissionIdempotencyKey,
  releaseSubmissionLock,
  submissionIdempotencyStorageKey,
  tryAcquireSubmissionLock,
  type SessionStorageLike,
} from './submissionIdempotency';

function memoryStorage(): SessionStorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('submission idempotency identity', () => {
  it('rejects a second submit while the first submit holds the synchronous lock', () => {
    const lock = { current: false };

    expect(tryAcquireSubmissionLock(lock)).toBe(true);
    expect(tryAcquireSubmissionLock(lock)).toBe(false);
    releaseSubmissionLock(lock);
    expect(tryAcquireSubmissionLock(lock)).toBe(true);
  });

  it.each([
    'contract-dev',
    'grift-team-beta',
    'grift-paid-trial',
    'estimate-audit',
  ] as const)('reuses the same %s session-and-intent-scoped key after a reload', (intent) => {
    const storage = memoryStorage();
    const createKey = vi.fn()
      .mockReturnValueOnce('key-before-reload')
      .mockReturnValueOnce('must-not-be-used');

    const beforeReload = getOrCreateSubmissionIdempotencyKey(
      storage,
      intent,
      'session-1',
      createKey,
    );
    const afterReload = getOrCreateSubmissionIdempotencyKey(
      storage,
      intent,
      'session-1',
      createKey,
    );

    expect(afterReload).toBe(beforeReload);
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('issues a different key only after a new conversation gets a new session', () => {
    const storage = memoryStorage();
    const createKey = vi.fn()
      .mockReturnValueOnce('key-conversation-1')
      .mockReturnValueOnce('key-conversation-2');
    const first = getOrCreateSubmissionIdempotencyKey(storage, 'contract-dev', 'session-1', createKey);
    const firstConsentAt = getOrCreateHandoffConsentAcceptedAt(
      storage,
      'contract-dev',
      'session-1',
      () => '2026-07-14T01:00:00.000Z',
    );

    forgetSubmissionIdempotencyKey(storage, 'contract-dev', 'session-1');
    const second = getOrCreateSubmissionIdempotencyKey(storage, 'contract-dev', 'session-2', createKey);
    const secondConsentAt = getOrCreateHandoffConsentAcceptedAt(
      storage,
      'contract-dev',
      'session-2',
      () => '2026-07-14T02:00:00.000Z',
    );

    expect(first).toBe('key-conversation-1');
    expect(second).toBe('key-conversation-2');
    expect(second).not.toBe(first);
    expect(secondConsentAt).not.toBe(firstConsentAt);
  });

  it('reuses the consent timestamp with the key so a reload retry keeps the same fingerprint', () => {
    const storage = memoryStorage();
    const createTimestamp = vi.fn()
      .mockReturnValueOnce('2026-07-14T01:00:00.000Z')
      .mockReturnValueOnce('2026-07-14T02:00:00.000Z');

    const beforeReload = getOrCreateHandoffConsentAcceptedAt(
      storage,
      'grift-paid-trial',
      'session-1',
      createTimestamp,
    );
    const afterReload = getOrCreateHandoffConsentAcceptedAt(
      storage,
      'grift-paid-trial',
      'session-1',
      createTimestamp,
    );

    expect(afterReload).toBe(beforeReload);
    expect(createTimestamp).toHaveBeenCalledTimes(1);
  });

  it('separates intents and refuses an unscoped key', () => {
    const storage = memoryStorage();
    const createKey = vi.fn()
      .mockReturnValueOnce('key-contract')
      .mockReturnValueOnce('key-poc');

    expect(getOrCreateSubmissionIdempotencyKey(storage, null, 'session-1', createKey)).toBeNull();
    expect(getOrCreateSubmissionIdempotencyKey(storage, 'contract-dev', null, createKey)).toBeNull();
    expect(getOrCreateSubmissionIdempotencyKey(storage, 'contract-dev', 'session-1', createKey))
      .toBe('key-contract');
    expect(getOrCreateSubmissionIdempotencyKey(storage, 'local-llm-poc', 'session-1', createKey))
      .toBe('key-poc');
    expect(storage.values).toHaveProperty('size', 2);
  });

  it('replaces a forged stored value instead of forwarding it', () => {
    const storage = memoryStorage();
    storage.values.set(submissionIdempotencyStorageKey('contract-dev', 'session-1'), 'bad\nheader');

    expect(getOrCreateSubmissionIdempotencyKey(
      storage,
      'contract-dev',
      'session-1',
      () => 'safe-replacement',
    )).toBe('safe-replacement');
  });
});
