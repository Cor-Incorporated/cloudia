import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { contactCalendarHref } from '../constants/siteLinks';
import type { AppMode } from '../types';

interface IntroPanelProps {
  mode: AppMode;
  modeSwitchHref: string;
  /** embed（サイトの枠の中）のときは _top で、枠の外の page を動かす。 */
  calendarTarget?: '_top';
}

const introLinkClassName =
  'inline-flex min-h-11 items-center text-sm text-navy underline underline-offset-2 hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy';

const IntroPanel: React.FC<IntroPanelProps> = ({ mode, modeSwitchHref, calendarTarget }) => {
  const { locale, t } = useLanguage();

  return (
    <nav
      data-testid="cloudia-intro-panel"
      aria-label={t('introLinksLabel')}
      className="ml-10 mt-1 flex flex-wrap gap-x-4 px-3"
    >
      <a href={modeSwitchHref} className={introLinkClassName}>
        {t(mode === 'ambassador' ? 'introReceptionLink' : 'ambassadorLink')}
      </a>
      <a href={contactCalendarHref(locale)} target={calendarTarget} className={introLinkClassName}>
        {t('introCalendarLink')}
      </a>
    </nav>
  );
};

export default IntroPanel;
