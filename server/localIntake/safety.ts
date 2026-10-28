/**
 * Hardening helpers for the local intake spike.
 * Patterns follow corsweb workers/contact-chat validate.ts / security.ts.
 * Chat transcripts and Turnstile tokens are never written to logs.
 */

export const PII_EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE_RE = /(?<!\d)(?:\+?\d{1,3}[ -]?)?(?:0\d{1,4}[-ー－ ]?)?\d{2,4}[-ー－ ]?\d{3,4}[-ー－ ]?\d{3,4}(?!\d)/g;
const PII_POSTAL_RE = /(?:〒\s*)?\d{3}[-ー－ ]?\d{4}/g;
const PII_CARD_RE = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
const PII_OTP_RE = /(?:otp|one[- ]time|認証コード|確認コード|ワンタイム)[^\d]{0,20}\d{4,8}/gi;
const SECRET_TOKEN_RE = /(?:AIza[0-9A-Za-z_-]{20,}|(?:sk|ghp|xox[baprs]?)-[A-Za-z0-9_-]{16,}|-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----)/g;
const URL_RE = /https?:\/\/[^\s"]+/gi;
const BEARER_RE = /Bearer\s+\S+/gi;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function maskSensitiveContent(content: string): string {
  // Phone runs before postal so 090-1234-5678 is not half-matched as a postal code.
  return content
    .replace(SECRET_TOKEN_RE, '[redacted-secret]')
    .replace(PII_EMAIL_RE, '[redacted-email]')
    .replace(PII_OTP_RE, '[redacted-code]')
    .replace(PII_PHONE_RE, '[redacted-phone]')
    .replace(PII_POSTAL_RE, '[redacted-postal]')
    .replace(PII_CARD_RE, '[redacted-number]');
}

export function maskMessages(messages: ChatTurn[]): ChatTurn[] {
  return messages.map((message) => ({
    role: message.role,
    content: maskSensitiveContent(message.content),
  }));
}

/** Drop a field when masking would change it, so partial PII is not kept. */
export function maskOrDrop(value: string): string | undefined {
  const masked = maskSensitiveContent(value);
  return masked === value ? value : undefined;
}

export function redactSensitiveText(text: string, secrets: readonly string[] = []): string {
  let out = maskSensitiveContent(text)
    .replace(URL_RE, '[redacted-url]')
    .replace(BEARER_RE, 'Bearer [redacted-secret]');
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join('[redacted-secret]');
  }
  return out;
}

export type TurnstileLogState = 'not_required' | 'skipped' | 'verified' | 'rejected' | 'misconfigured';

export type LocalIntakeErrorCode =
  | 'invalid_json'
  | 'invalid_messages'
  | 'invalid_context'
  | 'rate_limited'
  | 'turnstile_required'
  | 'turnstile_failed'
  | 'turnstile_unconfigured'
  | 'gateway_unconfigured'
  | 'model_rejected'
  | 'gateway_failed'
  | 'served_model_mismatch'
  | 'implicit_fallback'
  | 'body_too_large';

export interface SafeLogEvent {
  event: 'local_intake';
  route: 'chat' | 'chat_start';
  status: number;
  provider: 'local';
  modelAlias: string | null;
  servedModel: string | null;
  mode: 'intake' | 'ambassador' | null;
  locale: 'ja' | 'en' | null;
  intent: string | null;
  messageCount: number;
  userChars: number;
  classification: 'genuine' | 'sales' | 'spam' | null;
  turnstile: TurnstileLogState;
  durationMs: number;
  errorCode: LocalIntakeErrorCode | null;
}

export function emitSafeLog(
  event: SafeLogEvent,
  write: (line: string) => void,
  secrets: readonly string[] = [],
): void {
  write(redactSensitiveText(JSON.stringify(event), secrets));
}

export type TurnstileDecision =
  | { action: 'allow'; state: 'not_required' | 'skipped' | 'verified' }
  | { action: 'deny'; status: 400 | 403 | 503; state: 'rejected' | 'misconfigured'; errorCode: 'turnstile_required' | 'turnstile_failed' | 'turnstile_unconfigured' };

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileCheck {
  policy: 'optional' | 'required';
  token: unknown;
  secret: string | undefined;
  remoteIp?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Chat uses policy `optional` (ADR-0006 / contact-chat handleChat): a missing
 * token does not block the conversation. A presented token is verified when
 * the secret exists. Policy `required` fail-closes when the secret is absent
 * so this spike cannot skip verification by leaving the secret empty.
 */
export async function evaluateTurnstile(check: TurnstileCheck): Promise<TurnstileDecision> {
  const secret = check.secret?.trim() ?? '';
  const token = typeof check.token === 'string' ? check.token.trim() : '';
  const tokenPresent = token.length > 0;

  if (check.policy === 'optional' && !tokenPresent) {
    return { action: 'allow', state: 'not_required' };
  }
  if (!secret) {
    if (check.policy === 'required') {
      return { action: 'deny', status: 503, state: 'misconfigured', errorCode: 'turnstile_unconfigured' };
    }
    return { action: 'allow', state: 'skipped' };
  }
  if (!tokenPresent || token.length > 4096 || /[\s\u0000-\u001F\u007F]/.test(token)) {
    return { action: 'deny', status: 400, state: 'rejected', errorCode: 'turnstile_required' };
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (check.remoteIp && check.remoteIp !== 'unknown') form.set('remoteip', check.remoteIp);

  const fetchImpl = check.fetchImpl ?? fetch;
  let success = false;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await response.json() as { success?: boolean };
    success = data.success === true;
  } catch {
    return { action: 'deny', status: 503, state: 'rejected', errorCode: 'turnstile_failed' };
  }
  if (!success) {
    return { action: 'deny', status: 403, state: 'rejected', errorCode: 'turnstile_failed' };
  }
  return { action: 'allow', state: 'verified' };
}
