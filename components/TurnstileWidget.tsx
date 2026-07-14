import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations';
import type { TurnstileStatus } from '../types';

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_ORIGIN = 'https://challenges.cloudflare.com';
const TURNSTILE_SCRIPT_PATH = '/turnstile/v0/api.js';
const TURNSTILE_ACTION = 'contact-submit';
const TURNSTILE_LOAD_TIMEOUT_MS = 10_000;
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  language: 'ja' | 'en';
  size: 'flexible' | 'compact';
  theme: 'auto';
  retry: 'never';
  'refresh-expired': 'manual';
  'refresh-timeout': 'manual';
  'response-field': false;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => boolean;
  'timeout-callback': () => void;
}

interface TurnstileApi {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileApiPromise: Promise<TurnstileApi> | null = null;

export function normalizeTurnstileSiteKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTurnstileToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token && token.length <= MAX_TURNSTILE_TOKEN_LENGTH ? token : null;
}

export function isOfficialTurnstileScriptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === TURNSTILE_SCRIPT_ORIGIN
      && url.pathname === TURNSTILE_SCRIPT_PATH
      && url.searchParams.get('render') === 'explicit';
  } catch {
    return false;
  }
}

function getTurnstileApi(): TurnstileApi | null {
  const api = window.turnstile;
  return api
    && typeof api.ready === 'function'
    && typeof api.render === 'function'
    && typeof api.reset === 'function'
    && typeof api.remove === 'function'
    ? api
    : null;
}

function findExistingTurnstileScript(): HTMLScriptElement | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  return scripts.find((script) => isOfficialTurnstileScriptUrl(script.src)) ?? null;
}

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (turnstileApiPromise) return turnstileApiPromise;

  turnstileApiPromise = new Promise<TurnstileApi>((resolve, reject) => {
    let script = findExistingTurnstileScript();
    const existingApi = getTurnstileApi();
    if (existingApi && script) {
      existingApi.ready(() => resolve(existingApi));
      return;
    }
    if (existingApi) {
      reject(new Error('Turnstile API origin could not be verified'));
      return;
    }

    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (script?.dataset.cloudiaTurnstileApi === 'true') script.remove();
      reject(new Error('Turnstile API unavailable'));
    };
    const handleLoad = () => {
      if (settled) return;
      const api = getTurnstileApi();
      if (!api) {
        fail();
        return;
      }
      api.ready(() => {
        if (settled) return;
        settled = true;
        if (script) script.dataset.cloudiaTurnstileLoaded = 'true';
        cleanup();
        resolve(api);
      });
    };
    const handleError = () => fail();

    if (!script) {
      script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.cloudiaTurnstileApi = 'true';
    }
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    timeoutId = window.setTimeout(fail, TURNSTILE_LOAD_TIMEOUT_MS);

    if (!script.isConnected) {
      document.head.appendChild(script);
    } else if (script.dataset.cloudiaTurnstileLoaded === 'true') {
      window.queueMicrotask(handleLoad);
    }
  });

  void turnstileApiPromise.catch(() => {
    turnstileApiPromise = null;
  });
  return turnstileApiPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
}

const STATUS_KEY: Record<TurnstileStatus, keyof typeof translations.en> = {
  loading: 'turnstileLoading',
  ready: 'turnstileReady',
  verified: 'turnstileVerified',
  expired: 'turnstileExpired',
  error: 'turnstileError',
  timeout: 'turnstileTimeout',
};

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  resetSignal,
  onTokenChange,
}) => {
  const { locale, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const previousResetSignalRef = useRef(resetSignal);
  const [status, setStatus] = useState<TurnstileStatus>('loading');

  const invalidateAndReset = (nextStatus: TurnstileStatus) => {
    onTokenChange(null);
    setStatus(nextStatus);
    const api = apiRef.current;
    const widgetId = widgetIdRef.current;
    if (!api || !widgetId) return;
    try {
      api.reset(widgetId);
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    let active = true;
    let callbackOccurred = false;
    setStatus('loading');
    onTokenChange(null);

    void loadTurnstileApi().then((api) => {
      if (!active || !containerRef.current || widgetIdRef.current) return;
      apiRef.current = api;
      try {
        const size = containerRef.current.clientWidth < 300 ? 'compact' : 'flexible';
        const widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          language: locale,
          size,
          theme: 'auto',
          retry: 'never',
          'refresh-expired': 'manual',
          'refresh-timeout': 'manual',
          'response-field': false,
          callback: (value) => {
            if (!active) return;
            callbackOccurred = true;
            const nextToken = normalizeTurnstileToken(value);
            onTokenChange(nextToken);
            setStatus(nextToken ? 'verified' : 'error');
          },
          'expired-callback': () => {
            if (active) invalidateAndReset('expired');
          },
          'error-callback': () => {
            if (active) invalidateAndReset('error');
            return true;
          },
          'timeout-callback': () => {
            if (active) invalidateAndReset('timeout');
          },
        });
        if (!widgetId) throw new Error('Turnstile widget was not created');
        widgetIdRef.current = widgetId;
        if (!callbackOccurred) setStatus('ready');
      } catch {
        onTokenChange(null);
        setStatus('error');
      }
    }).catch(() => {
      if (!active) return;
      onTokenChange(null);
      setStatus('error');
    });

    return () => {
      active = false;
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      apiRef.current = null;
      if (api && widgetId) {
        try {
          api.remove(widgetId);
        } catch {
          // The widget may already have removed itself after a terminal error.
        }
      }
    };
  }, [locale, onTokenChange, siteKey]);

  useEffect(() => {
    if (previousResetSignalRef.current === resetSignal) return;
    previousResetSignalRef.current = resetSignal;
    invalidateAndReset('ready');
  }, [resetSignal]);

  return (
    <div className="min-w-0 space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200" aria-labelledby="cloudia-turnstile-label">
      <p id="cloudia-turnstile-label" className="text-xs font-medium leading-relaxed text-slate-800">
        {t('turnstileLabel')}
      </p>
      <div ref={containerRef} className="cloudia-turnstile min-h-[65px] w-full min-w-0" />
      <p
        id="cloudia-turnstile-status"
        className="text-xs leading-relaxed text-slate-600"
        data-turnstile-status={status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {t(STATUS_KEY[status])}
      </p>
    </div>
  );
};

export default TurnstileWidget;
