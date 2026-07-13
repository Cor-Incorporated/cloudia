import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

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
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (values: HandoffValues) => void;
}

const HandoffForm: React.FC<HandoffFormProps> = ({ values, onChange, disabled, onBack, onCancel, onSubmit }) => {
  const { t } = useLanguage();
  // honeypot
  const [website, setWebsite] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return; // bot
    if (!values.name.trim() || !values.email.trim()) return;
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
    'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100';

  return (
    <form onSubmit={handleSubmit} className="relative space-y-3 border-t border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">{t('handoffTitle')}</p>
      <p className="text-xs text-slate-500">{t('handoffHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-700">
          <span>{t('handoffName')}</span>
          <input className={field} value={values.name} onChange={(e) => update('name', e.target.value)} required disabled={disabled} autoComplete="name" />
        </label>
        <label className="space-y-1 text-xs text-slate-700">
          <span>{t('handoffEmail')}</span>
          <input className={field} type="email" value={values.email} onChange={(e) => update('email', e.target.value)} required disabled={disabled} autoComplete="email" />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-slate-700">
        <span>{t('handoffCompany')}</span>
        <input className={field} value={values.company} onChange={(e) => update('company', e.target.value)} disabled={disabled} autoComplete="organization" />
      </label>
      <label className="block space-y-1 text-xs text-slate-700">
        <span>{t('handoffMessage')}</span>
        <textarea className={field + ' min-h-[72px]'} value={values.message} onChange={(e) => update('message', e.target.value)} disabled={disabled} />
      </label>
      {/* honeypot */}
      <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <label>
          website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={onBack}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {t('backToChat')}
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="min-h-11 w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 sm:w-auto"
        >
          {t('handoffSubmit')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="min-h-11 w-full px-2 py-2.5 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {t('cancelConversation')}
        </button>
      </div>
    </form>
  );
};

export default HandoffForm;
