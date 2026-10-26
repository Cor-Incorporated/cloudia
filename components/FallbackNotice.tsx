import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface FallbackNoticeProps {
  visible: boolean;
  onRetry?: () => void;
}

// corsweb routes every inquiry through Cloudia and keeps no contact form
// (corsweb ADR-0005, 2026-09-13 revision). Do not link to a "contact form"
// here: cor-jp.com/contact/ only reopens this chat, so such a link sends the
// visitor in a circle (corsweb #352). Offer the retry only.
const FallbackNotice: React.FC<FallbackNoticeProps> = ({ visible, onRetry }) => {
  const { t } = useLanguage();
  if (!visible) return null;

  return (
    <div
      className="mx-3 mb-2 shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-200 sm:mx-5"
      role="status"
    >
      <p>{t('fallbackNotice')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
};

export default FallbackNotice;
