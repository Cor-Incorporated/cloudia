import type { ContactIntent } from '../types';

const STORAGE_PREFIX = 'cloudia:contact-submit-idempotency:v1';
const CONSENT_TIME_PREFIX = 'cloudia:grift-consent-accepted-at:v1';
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,128}$/;

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SubmissionLock {
  current: boolean;
}

export function tryAcquireSubmissionLock(lock: SubmissionLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseSubmissionLock(lock: SubmissionLock): void {
  lock.current = false;
}

export function submissionIdempotencyStorageKey(intent: ContactIntent, sessionId: string): string {
  return `${STORAGE_PREFIX}:${intent}:${encodeURIComponent(sessionId)}`;
}

function consentAcceptedAtStorageKey(intent: ContactIntent, sessionId: string): string {
  return `${CONSENT_TIME_PREFIX}:${intent}:${encodeURIComponent(sessionId)}`;
}

export function getOrCreateSubmissionIdempotencyKey(
  storage: SessionStorageLike,
  intent: ContactIntent | null,
  sessionId: string | null,
  createKey: () => string,
): string | null {
  const normalizedSessionId = sessionId?.trim() ?? '';
  if (!intent || !normalizedSessionId) return null;
  const storageKey = submissionIdempotencyStorageKey(intent, normalizedSessionId);
  try {
    const stored = storage.getItem(storageKey)?.trim() ?? '';
    if (SAFE_IDEMPOTENCY_KEY.test(stored)) return stored;
    const created = createKey().trim();
    if (!SAFE_IDEMPOTENCY_KEY.test(created)) return null;
    storage.setItem(storageKey, created);
    return created;
  } catch {
    return null;
  }
}

export function getOrCreateHandoffConsentAcceptedAt(
  storage: SessionStorageLike,
  intent: ContactIntent | null,
  sessionId: string | null,
  createTimestamp: () => string,
): string | null {
  const normalizedSessionId = sessionId?.trim() ?? '';
  if (!intent || !normalizedSessionId) return null;
  const storageKey = consentAcceptedAtStorageKey(intent, normalizedSessionId);
  try {
    const stored = storage.getItem(storageKey)?.trim() ?? '';
    const storedTime = Date.parse(stored);
    if (stored && Number.isFinite(storedTime)) return new Date(storedTime).toISOString();
    const created = createTimestamp().trim();
    const createdTime = Date.parse(created);
    if (!created || !Number.isFinite(createdTime)) return null;
    const normalized = new Date(createdTime).toISOString();
    storage.setItem(storageKey, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function forgetSubmissionIdempotencyKey(
  storage: SessionStorageLike,
  intent: ContactIntent | null,
  sessionId: string | null,
): void {
  const normalizedSessionId = sessionId?.trim() ?? '';
  if (!intent || !normalizedSessionId) return;
  try {
    storage.removeItem(submissionIdempotencyStorageKey(intent, normalizedSessionId));
    storage.removeItem(consentAcceptedAtStorageKey(intent, normalizedSessionId));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
