import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface HandoffValues {
  name: string;
  email: string;
  company: string;
  message: string;
}

interface HandoffFormProps {
  disabled?: boolean;
  onSubmit: (values: HandoffValues) => void;
}

const HandoffForm: React.FC<HandoffFormProps> = ({ disabled, onSubmit }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  // honeypot
  const [website, setWebsite] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return; // bot
    if (!name.trim() || !email.trim()) return;
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      message: message.trim(),
    });
  };

  const field =
    'w-full p-2.5 rounded-lg bg-gray-700 border border-gray-600 text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <form onSubmit={handleSubmit} className="relative space-y-3 p-4 border-t border-gray-700 bg-gray-800/80">
      <p className="text-sm text-gray-200 font-medium">{t('handoffTitle')}</p>
      <p className="text-xs text-gray-400">{t('handoffHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-gray-300 space-y-1">
          <span>{t('handoffName')}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required disabled={disabled} autoComplete="name" />
        </label>
        <label className="text-xs text-gray-300 space-y-1">
          <span>{t('handoffEmail')}</span>
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={disabled} autoComplete="email" />
        </label>
      </div>
      <label className="text-xs text-gray-300 space-y-1 block">
        <span>{t('handoffCompany')}</span>
        <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} disabled={disabled} autoComplete="organization" />
      </label>
      <label className="text-xs text-gray-300 space-y-1 block">
        <span>{t('handoffMessage')}</span>
        <textarea className={field + ' min-h-[72px]'} value={message} onChange={(e) => setMessage(e.target.value)} disabled={disabled} />
      </label>
      {/* honeypot */}
      <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <label>
          website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white text-sm font-semibold rounded-lg"
      >
        {t('handoffSubmit')}
      </button>
    </form>
  );
};

export default HandoffForm;
