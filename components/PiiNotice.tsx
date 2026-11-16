import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import PrivacyPolicyLink from './PrivacyPolicyLink';

const PiiNotice: React.FC = () => {
  const { t } = useLanguage();

  return (
    <p
      className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200"
      role="note"
    >
      {t('piiNotice')}
      <PrivacyPolicyLink className="mt-1 block" />
    </p>
  );
};

export default PiiNotice;
