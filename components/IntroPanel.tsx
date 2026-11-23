import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { contactCalendarHref } from '../constants/siteLinks';
import type { AppMode } from '../types';

interface IntroPanelProps {
  mode: AppMode;
  modeSwitchHref: string;
  /** embed（サイトの枠の中）のときは _top で、枠の外の page を動かす。 */
  calendarTarget?: '_top';
  /** 業種を設定していない一般の入口だけ、既存の資料請求 form を出す。 */
  materialsHref?: string;
}

const introLinkClassName =
  'inline-flex min-h-11 items-center text-sm text-navy underline underline-offset-2 hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy';

const IntroPanel: React.FC<IntroPanelProps> = ({ mode, modeSwitchHref, calendarTarget, materialsHref }) => {
  const { locale, t } = useLanguage();

  return (
    <nav
      data-testid="cloudia-intro-panel"
      aria-label={t('introLinksLabel')}
      className="mt-2 flex flex-wrap gap-x-4"
    >
      <a href={modeSwitchHref} className={introLinkClassName}>
        {t(mode === 'ambassador' ? 'introReceptionLink' : 'ambassadorLink')}
      </a>
      <a href={contactCalendarHref(locale)} target={calendarTarget} className={introLinkClassName}>
        {t('introCalendarLink')}
      </a>
      {materialsHref && (
        <a href={materialsHref} target={calendarTarget} className={introLinkClassName}>
          {t('materialRequestLink')}
        </a>
      )}
    </nav>
  );
};

export default IntroPanel;
