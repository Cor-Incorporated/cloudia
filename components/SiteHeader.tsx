import React from 'react';
import ExpressionAvatar from './ExpressionAvatar';
import LanguageMenu, { LanguageSwitch } from './LanguageMenu';
import type { Locale } from '../translations';
import type { Emotion } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SiteHeaderProps {
  emotion: Emotion;
  returnHref: string | null;
  returnLabel: string | null;
  locale: Locale;
  onSelectLocale: (locale: Locale) => void;
  /** 開発中の mock の表示（今まで題の下に出していた物）。 */
  showMockBadge?: boolean;
}

/**
 * 3 サイト共通の header。1024px 以上は 64px・未満は 56px の 1 段。
 * ロゴは link にしない（読み上げと tab の止まる所を増やさない）。
 * 右の組は、1024px 以上用の言語 → 戻る link → 1024px 未満用の言語の順に置く
 * （CSS の order ではなく DOM の順で、見た目と tab の順をそろえる）。
 */
const SiteHeader: React.FC<SiteHeaderProps> = ({
  emotion,
  returnHref,
  returnLabel,
  locale,
  onSelectLocale,
  showMockBadge = false,
}) => {
  const { t } = useLanguage();

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-stone-200 bg-stone-50 px-3 lg:h-16 lg:px-6"
    >
      <div className="flex min-w-[3rem] flex-1 items-center gap-2 lg:gap-6">
        <div data-testid="header-avatar" className="shrink-0">
          <ExpressionAvatar emotion={emotion} size={40} compact />
        </div>
        <div className="min-w-0">
          <h1 className="sr-only text-base font-semibold text-stone-900 lg:not-sr-only lg:truncate">
            {t('title')}
          </h1>
          {showMockBadge && (
            <p className="hidden text-xs text-amber-700 lg:block">contact-chat MOCK</p>
          )}
        </div>
      </div>

      <div
        data-testid="header-right"
        className="ml-auto flex min-w-0 shrink items-center gap-1.5 lg:gap-3"
      >
        <LanguageMenu locale={locale} onSelectLocale={onSelectLocale} />
        {returnHref && returnLabel && (
          <a
            data-testid="header-return"
            href={returnHref}
            title={returnLabel}
            className="inline-flex min-h-11 min-w-11 items-center justify-center overflow-hidden rounded-full border border-navy px-2 text-sm font-semibold text-navy no-underline hover:bg-navy/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy lg:px-3.5"
          >
            <span aria-hidden="true" className="shrink-0">←</span>
            <span className="ml-1.5 min-w-0 truncate">{returnLabel}</span>
          </a>
        )}
        <LanguageSwitch locale={locale} onSelectLocale={onSelectLocale} />
      </div>
    </header>
  );
};

export default SiteHeader;
