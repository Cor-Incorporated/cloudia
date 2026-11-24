import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ContractorInquiryPanelProps {
  onInquire: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
}

/**
 * 一般受付で、利用中のサービスについて問い合わせる人の選択肢。
 * 新しい intent や受領先は作らず、既存の用件確認 → 連絡先 → 送信の流れへ渡す。
 */
const ContractorInquiryPanel: React.FC<ContractorInquiryPanelProps> = ({ onInquire, buttonRef, disabled }) => {
  const { t } = useLanguage();

  return (
    <section
      data-testid="contractor-inquiry"
      aria-labelledby="contractor-inquiry-title"
      className="rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-4"
    >
      <h2 id="contractor-inquiry-title" className="text-balance text-sm font-semibold leading-relaxed text-slate-950">
        {t('contractorInquiryTitle')}
      </h2>
      <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-700">{t('contractorInquiryBody')}</p>
      <button
        ref={buttonRef}
        type="button"
        onClick={onInquire}
        disabled={disabled}
        className="mt-3 min-h-11 w-full rounded-lg bg-navy px-4 py-2.5 text-[13px] font-semibold leading-relaxed text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {t('contractorInquiryCta')}
      </button>
    </section>
  );
};

export default ContractorInquiryPanel;
