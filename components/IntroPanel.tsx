import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { contactCalendarHref } from '../constants/siteLinks';
import type { AppMode } from '../types';

interface IntroPanelProps {
  /** 今の mode。雑談のときは、2 行目を「ご相談の受付へ」の向きに替える。 */
  mode: AppMode;
  /** 頭の mode 切り替え link と同じ行き先。 */
  modeSwitchHref: string;
  /** embed（サイトの枠の中）のときは _top で、枠の外の page を動かす。 */
  calendarTarget?: '_top';
  /** 「準備中」の行の旗（constants/introPanel.ts）。 */
  bookingNoticeVisible: boolean;
}

const introLinkClassName =
  'text-navy underline underline-offset-2 hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy';

/**
 * 最初の message の上の説明の区画。ここで出来る事（引き継ぎ・雑談・カレンダー閲覧）と、
 * 準備中の事（予約）を 1 つの小さい区画に書く。embed（枠の中）でも外でも出す。
 */
const IntroPanel: React.FC<IntroPanelProps> = ({ mode, modeSwitchHref, calendarTarget, bookingNoticeVisible }) => {
  const { locale, t } = useLanguage();

  return (
    <div
      data-testid="cloudia-intro-panel"
      className="ml-10 mt-1 max-w-2xl rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-sm sm:p-4"
    >
      <p className="m-0 font-semibold text-slate-900">{t('introHeading')}</p>
      <p className="m-0 mt-1.5">{t('introHandoff')}</p>
      <p className="m-0 mt-1.5">
        {mode === 'ambassador' ? (
          <>
            {t('introReceptionBefore')}
            <a href={modeSwitchHref} className={introLinkClassName}>{t('introReceptionLink')}</a>
            {t('introReceptionAfter')}
          </>
        ) : (
          <>
            {t('introChatBefore')}
            <a href={modeSwitchHref} className={introLinkClassName}>{t('ambassadorLink')}</a>
            {t('introChatAfter')}
          </>
        )}
      </p>
      <p className="m-0 mt-1.5">
        {t('introCalendarBefore')}
        <a href={contactCalendarHref(locale)} target={calendarTarget} className={introLinkClassName}>
          {t('introCalendarLink')}
        </a>
        {t('introCalendarAfter')}
      </p>
      {bookingNoticeVisible && <p className="m-0 mt-1.5">{t('introBookingPreparation')}</p>}
    </div>
  );
};

export default IntroPanel;
