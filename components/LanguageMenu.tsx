import React, { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../translations';
import { useLanguage } from '../contexts/LanguageContext';

export interface LanguageMenuState {
  open: boolean;
}

export type LanguageMenuEvent =
  | { type: 'toggle' }
  | { type: 'close' }
  | { type: 'blur-out' }
  | { type: 'select'; locale: Locale };

export interface LanguageMenuResult extends LanguageMenuState {
  selected?: Locale;
}

/** 開閉と選択の決め方（描画の外で試験できるように分ける）。 */
export function languageMenuReducer(
  state: LanguageMenuState,
  event: LanguageMenuEvent,
): LanguageMenuResult {
  switch (event.type) {
    case 'toggle':
      return { open: !state.open };
    case 'close':
    case 'blur-out':
      return { open: false };
    case 'select':
      return { open: false, selected: event.locale };
  }
}

/** focus が部品の外へ出たら閉じるか。中なら閉じない・外か null なら閉じる・container が無ければ閉じない。 */
export function shouldCloseOnBlur(
  relatedTarget: Node | null,
  container: { contains(node: Node | null): boolean } | null,
): boolean {
  if (!container) return false;
  if (relatedTarget === null) return true;
  return !container.contains(relatedTarget);
}

/** 押された所が部品の外か。中なら false・外か null なら true・container が無ければ false。 */
export function isOutsidePointer(
  target: Node | null,
  container: { contains(node: Node | null): boolean } | null,
): boolean {
  if (!container) return false;
  return !container.contains(target);
}

/** Escape の key か。 */
export function isEscapeKey(key: string): boolean {
  return key === 'Escape';
}

const OPTIONS: Array<{ locale: Locale; flag: string; label: string; short: string }> = [
  { locale: 'ja', flag: '🇯🇵', label: '日本語', short: 'JA' },
  { locale: 'en', flag: '🇺🇸', label: 'English', short: 'EN' },
];

function currentOption(locale: Locale) {
  return OPTIONS.find((option) => option.locale === locale) ?? OPTIONS[0];
}

interface LanguageMenuPanelProps {
  id?: string;
  locale: Locale;
  onSelect: (locale: Locale) => void;
}

/**
 * 開いた中身。menu ではなく、今の言語を示す 2 つの押しボタン（disclosure）。
 * Tab で自然に入れるよう、開いた順のまま DOM に置く。
 */
export const LanguageMenuPanel: React.FC<LanguageMenuPanelProps> = ({ id, locale, onSelect }) => {
  return (
    <div
      id={id}
      data-testid="language-menu"
      className="absolute right-0 top-full z-50 mt-2 min-w-36 rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          aria-pressed={locale === option.locale}
          onClick={() => onSelect(option.locale)}
          className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
            locale === option.locale
              ? 'bg-stone-100 font-semibold text-stone-900'
              : 'text-stone-900 hover:bg-stone-100'
          }`}
        >
          <span aria-hidden="true">{option.flag}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};

interface LanguageMenuProps {
  locale: Locale;
  onSelectLocale: (locale: Locale) => void;
}

/**
 * 1024px 以上の言語の切替。1 つの開閉する button（disclosure）と、その下の中身。
 * Escape・外押し・focus が部品の外へ出た時に閉じる。
 */
const LanguageMenu: React.FC<LanguageMenuProps> = ({ locale, onSelectLocale }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const option = currentOption(locale);

  const closeAndFocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (isOutsidePointer(event.target as Node | null, wrapRef.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      data-testid="header-languages"
      className="relative hidden shrink-0 lg:block"
      onBlur={(event) => {
        if (!open) return;
        if (shouldCloseOnBlur(event.relatedTarget as Node | null, wrapRef.current)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (isEscapeKey(event.key) && open) {
          event.stopPropagation();
          closeAndFocus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t('languageMenuLabel')}: ${option.short}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 min-w-11 items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-900 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <span aria-hidden="true">{option.flag}</span>
        <span>{option.short}</span>
        <span aria-hidden="true" className="text-[10px] text-stone-600">▾</span>
      </button>
      {open && (
        <LanguageMenuPanel
          id={panelId}
          locale={locale}
          onSelect={(next) => {
            onSelectLocale(next);
            closeAndFocus();
          }}
        />
      )}
    </div>
  );
};

interface LanguageSwitchProps {
  locale: Locale;
  onSelectLocale: (locale: Locale) => void;
}

/**
 * 1024px 未満の言語の切替。今までどおり 2 つの押しボタン。
 */
export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ locale, onSelectLocale }) => {
  const { t } = useLanguage();

  return (
    <div
      data-testid="header-languages"
      className="flex shrink-0 items-center gap-1 lg:hidden"
      role="group"
      aria-label={t('languageMenuLabel')}
    >
      <button
        type="button"
        aria-pressed={locale === 'en'}
        onClick={() => onSelectLocale('en')}
        className={`min-h-11 min-w-11 rounded-full border bg-white px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
          locale === 'en' ? 'border-navy font-semibold text-navy' : 'border-stone-200 text-stone-600'
        }`}
      >
        English
      </button>
      <button
        type="button"
        aria-pressed={locale === 'ja'}
        onClick={() => onSelectLocale('ja')}
        className={`min-h-11 min-w-11 rounded-full border bg-white px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
          locale === 'ja' ? 'border-navy font-semibold text-navy' : 'border-stone-200 text-stone-600'
        }`}
      >
        日本語
      </button>
    </div>
  );
};

export default LanguageMenu;
