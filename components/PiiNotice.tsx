import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import PrivacyPolicyLink from './PrivacyPolicyLink';

interface PiiNoticeProps {
  /**
   * 業態入口など、この画面専用の安全文。省略時は汎用の piiNotice。
   * どちらの場合も同意先の privacy policy link は同じ 1 本を出す。
   */
  note?: string;
}

const PiiNotice: React.FC<PiiNoticeProps> = ({ note }) => {
  const { t } = useLanguage();

  return (
    <p
      className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200"
      role="note"
    >
      {note ?? t('piiNotice')}
      <PrivacyPolicyLink className="mt-1 block" label={note ? t('privacyLinkText') : undefined} />
    </p>
  );
};

export default PiiNotice;
