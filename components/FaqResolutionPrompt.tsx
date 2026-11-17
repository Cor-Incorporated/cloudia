import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface FaqResolutionPromptProps {
  disabled?: boolean;
  onResolved: () => void;
  onUnresolved: () => void;
}

const FaqResolutionPrompt: React.FC<FaqResolutionPromptProps> = ({
  disabled = false,
  onResolved,
  onUnresolved,
}) => {
  const { t } = useLanguage();

  return (
    <div
      className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-3"
      role="group"
      aria-label={t('faqConfirmQuestion')}
    >
      <p className="text-xs leading-relaxed text-slate-600">{t('faqConfirmQuestion')}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={disabled}
          className="min-h-11 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onResolved}
        >
          {t('faqResolvedYes')}
        </button>
        <button
          type="button"
          disabled={disabled}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onUnresolved}
        >
          {t('faqResolvedNo')}
        </button>
      </div>
    </div>
  );
};

export default FaqResolutionPrompt;
