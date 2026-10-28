/**
 * Vite dev-server adapter. Mounted only when CLOUDIA_INTAKE_PROVIDER=local.
 * /api/contact/submit is intentionally not handled: PII and Turnstile-on-submit
 * stay on corsweb workers/contact-chat.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isLocalIntakeEnabled, type LocalIntakeEnv } from './gateway';
import { handleLocalIntake, type LocalIntakeDeps } from './handle';

const CHAT_PATHS = new Set(['/api/contact/chat', '/api/contact/chat/start']);
const RESPONSE_HEADERS = new Set([
  'content-type',
  'cache-control',
  'x-content-type-options',
  'referrer-policy',
  'retry-after',
  'x-cloudia-intake-provider',
]);

export function createLocalIntakeMiddleware(env: LocalIntakeEnv, deps: LocalIntakeDeps = {}) {
  return function localIntakeMiddleware(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): void {
    if (!isLocalIntakeEnabled(env)) {
      next();
      return;
    }
    const path = (req.url || '').split('?')[0];
    if (req.method !== 'POST' || !CHAT_PATHS.has(path)) {
      next();
      return;
    }
    void forward(req, res, env, deps).catch(() => {
      if (res.headersSent) return;
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({ error: '処理中にエラーが発生しました' }));
    });
  };
}

async function forward(req: IncomingMessage, res: ServerResponse, env: LocalIntakeEnv, deps: LocalIntakeDeps): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await readLimited(req, 64 * 1024);
  } catch {
    res.statusCode = 413;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ error: 'AIが一時的に利用できません。時間をおいて再試行してください' }));
    return;
  }
  const host = typeof req.headers.host === 'string' ? req.headers.host : '127.0.0.1';
  const request = new Request(`http://${host}${req.url || '/api/contact/chat'}`, {
    method: 'POST',
    headers: {
      'content-type': typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type']
        : 'application/json',
    },
    body: bytes,
  });
  const response = await handleLocalIntake(request, env, {
    ...deps,
    clientIp: req.socket?.remoteAddress || deps.clientIp || 'local',
    log: deps.log ?? ((line) => console.info(line)),
  });
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (RESPONSE_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
  });
  const payload = Buffer.from(await response.arrayBuffer());
  res.end(payload);
}

async function readLimited(req: IncomingMessage, maxBytes: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw new Error('body_too_large');
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}
