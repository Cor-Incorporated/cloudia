import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const PiiNotice: React.FC = () => {
  const { t } = useLanguage();

  return (
    <p
      className="rounded-md bg-amber-900/40 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-600/50"
      role="note"
    >
      {t('piiNotice')}
    </p>
  );
};

export default PiiNotice;
