import { parseContactIntent } from '../constants/intents';
import type { ContactIntent } from '../types';
import type { Locale } from '../translations';

export const DEFAULT_CONTACT_SOURCE = 'cloudia';

export interface LaunchContext {
  source: string;
  locale: Locale;
  embed: boolean;
  intent: ContactIntent | null;
}

export function normalizeLocale(value: unknown, fallback: Locale = 'en'): Locale {
  return value === 'ja' || value === 'en' ? value : fallback;
}

export function normalizeContactSource(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CONTACT_SOURCE;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 64) return DEFAULT_CONTACT_SOURCE;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
    ? normalized
    : DEFAULT_CONTACT_SOURCE;
}

export function normalizeEmbed(value: unknown): boolean {
  return value === '1';
}

export function syncHtmlLang(root: { lang: string }, locale: unknown): void {
  root.lang = normalizeLocale(locale, 'en');
}

export function resolveLaunchContext(search: string, fallbackLocale: Locale = 'en'): LaunchContext {
  const params = new URLSearchParams(search);
  return {
    source: normalizeContactSource(params.get('source')),
    locale: normalizeLocale(params.get('locale'), fallbackLocale),
    embed: normalizeEmbed(params.get('embed')),
    intent: parseContactIntent(params.get('intent')),
  };
}
