import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getFallbackContactUrl } from '../services/contactChatClient';

interface FallbackNoticeProps {
  visible: boolean;
  onRetry?: () => void;
}

const FallbackNotice: React.FC<FallbackNoticeProps> = ({ visible, onRetry }) => {
  const { t } = useLanguage();
  if (!visible) return null;
  const href = getFallbackContactUrl();

  return (
    <div
      className="mx-3 mb-2 shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-200 sm:mx-5"
      role="status"
    >
      <p className="mb-1">{t('fallbackNotice')}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {t('retry')}
          </button>
        )}
        <a href={href} className="text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" rel="noopener noreferrer">
          {t('fallbackLink')}
        </a>
      </div>
    </div>
  );
};

export default FallbackNotice;
