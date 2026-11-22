import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import PrivacyPolicyLink from './PrivacyPolicyLink';

export interface HandoffValues {
  name: string;
  email: string;
  company: string;
  message: string;
}

interface HandoffFormProps {
  values: HandoffValues;
  onChange: (values: HandoffValues) => void;
  disabled?: boolean;
  submitFailed?: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (values: HandoffValues) => void;
}

const HandoffForm: React.FC<HandoffFormProps> = ({ values, onChange, disabled, submitFailed, onBack, onCancel, onSubmit }) => {
  const { t } = useLanguage();
  // honeypot
  const [website, setWebsite] = useState('');
  const [collectContact, setCollectContact] = useState(false);
  const [consent, setConsent] = useState(false);
  const inquiryInput = useRef<HTMLTextAreaElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (collectContact) nameInput.current?.focus();
    else inquiryInput.current?.focus();
  }, [collectContact]);
  useEffect(() => {
    if (submitFailed && !disabled) submitButton.current?.focus();
  }, [submitFailed, disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || website || !values.message.trim()) return;
    if (!collectContact) {
      setCollectContact(true);
      return;
    }
    if (!consent || !values.name.trim() || !values.email.trim()) return;
    onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      company: values.company.trim(),
      message: values.message.trim(),
    });
  };

  const update = (field: keyof HandoffValues, value: string) => {
    onChange({ ...values, [field]: value });
  };

  const field =
    'min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:bg-slate-100';

  return (
    <form onSubmit={handleSubmit} aria-labelledby="handoff-title" aria-busy={disabled} className="relative space-y-4 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <h1 id="handoff-title" className="text-balance text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">{t(collectContact ? 'handoffTitle' : 'handoffReviewTitle')}</h1>
      {!collectContact && (
        <>
          <p className="text-pretty text-base leading-relaxed text-slate-700">{t('handoffReviewHint')}</p>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>{t('handoffMessage')}</span>
            <span id="handoff-message-hint" className="block text-sm font-normal text-slate-700">{t('handoffMessageHint')}</span>
            <textarea ref={inquiryInput} aria-describedby="handoff-message-hint" className={field + ' min-h-[72px]'} value={values.message} onChange={(e) => {
              update('message', e.target.value);
              setConsent(false);
            }} required disabled={disabled} />
          </label>
        </>
      )}
      {collectContact && (
        <>
          <p className="text-pretty text-base leading-relaxed text-slate-700">
            {t('handoffHint')}
            <PrivacyPolicyLink className="mt-1 inline-flex min-h-6 items-center" label={t('privacyLinkText')} />
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>{t('handoffName')}</span>
              <input ref={nameInput} className={field} value={values.name} onChange={(e) => update('name', e.target.value)} required disabled={disabled} autoComplete="name" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>{t('handoffEmail')}</span>
              <input className={field} type="email" value={values.email} onChange={(e) => update('email', e.target.value)} required disabled={disabled} autoComplete="email" />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>{t('handoffCompany')}</span>
            <input className={field} value={values.company} onChange={(e) => update('company', e.target.value)} disabled={disabled} autoComplete="organization" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required disabled={disabled} />
            {t('handoffConsent')}
          </label>
        </>
      )}
      {/* honeypot */}
      <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <label>
          website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {submitFailed && (
        <p id="handoff-submit-error" role="alert" className="text-sm text-red-800">
          {t('handoffSubmitError')}
        </p>
      )}
      {/* The submit button comes first: in the narrow launcher panel the
          buttons stack, and the primary action should not sit below the fold. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          ref={submitButton}
          type="submit"
          aria-describedby={submitFailed ? 'handoff-submit-error' : undefined}
          disabled={disabled || !values.message.trim() || (collectContact && !consent)}
          className="min-h-11 w-full rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:bg-slate-300 sm:w-auto"
        >
          {t(collectContact ? disabled ? 'handoffSubmitting' : 'handoffSubmit' : 'handoffContinue')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={collectContact ? () => setCollectContact(false) : onBack}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {t(collectContact ? 'handoffEditMessage' : 'backToChat')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="min-h-11 w-full px-2 py-2.5 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {t('cancelConversation')}
        </button>
      </div>
    </form>
  );
};

export default HandoffForm;
