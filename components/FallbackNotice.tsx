import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getFallbackContactUrl } from '../services/contactChatClient';

interface FallbackNoticeProps {
  visible: boolean;
}

const FallbackNotice: React.FC<FallbackNoticeProps> = ({ visible }) => {
  const { t } = useLanguage();
  if (!visible) return null;
  const href = getFallbackContactUrl();

  return (
    <div
      className="mx-4 mb-2 rounded-md bg-gray-900/80 px-3 py-2 text-xs text-gray-300 ring-1 ring-gray-600"
      role="status"
    >
      <p className="mb-1">{t('fallbackNotice')}</p>
      <a href={href} className="text-blue-400 underline hover:text-blue-300" rel="noopener noreferrer">
        {t('fallbackLink')}
      </a>
    </div>
  );
};

export default FallbackNotice;
