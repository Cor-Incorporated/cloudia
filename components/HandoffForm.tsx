import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import TurnstileWidget from './TurnstileWidget';

export interface HandoffValues {
  name: string;
  email: string;
  company: string;
  message: string;
  summaryText: string;
  summaryConfirmed: boolean;
  privacyConsent: boolean;
  griftHandoffConsent: boolean;
}

const TRANSCRIPT_ROLE_LINE = /^(?:user|assistant|system|human|visitor|cloudia|ユーザー|あなた|訪問者|アシスタント|クラウディア)\s*(?:[:：]|[-—])\s*/i;

export function isConfirmedSummaryText(value: string): boolean {
  return Boolean(
    value.trim()
    && value.length <= 8000
    && !value.split(/\r?\n/).some((line) => TRANSCRIPT_ROLE_LINE.test(line.trim())),
  );
}

interface HandoffFormProps {
  values: HandoffValues;
  onChange: (values: HandoffValues) => void;
  disabled?: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (values: HandoffValues, turnstileToken?: string) => void;
  offersGriftHandoff?: boolean;
  turnstile?: HandoffTurnstileControl;
}

export interface HandoffTurnstileControl {
  siteKey: string;
  token: string | null;
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
  onResetRequest: () => void;
}

export function canSubmitHandoff(values: HandoffValues): boolean {
  // Grift consent is optional: ADR-0016 requires email intake to remain available
  // when an eligible visitor does not consent to the additional transfer.
  return Boolean(
    values.name.trim()
    && values.email.trim()
    && isConfirmedSummaryText(values.summaryText)
    && values.summaryConfirmed
    && values.privacyConsent
  );
}

const GRIFT_TRANSFER_FIELDS: ReadonlySet<keyof HandoffValues> = new Set([
  'name',
  'email',
  'company',
  'message',
  'summaryText',
]);

export function updateHandoffValues(
  values: HandoffValues,
  field: keyof HandoffValues,
  value: string | boolean,
  offersGriftHandoff: boolean,
): HandoffValues {
  const changed = values[field] !== value;
  const next = { ...values, [field]: value } as HandoffValues;
  if (!changed) return next;
  if (field === 'summaryText') {
    next.summaryConfirmed = false;
    next.griftHandoffConsent = false;
  }
  if (offersGriftHandoff && GRIFT_TRANSFER_FIELDS.has(field)) next.griftHandoffConsent = false;
  return next;
}

const HandoffForm: React.FC<HandoffFormProps> = ({
  values,
  onChange,
  disabled,
  onBack,
  onCancel,
  onSubmit,
  offersGriftHandoff = false,
  turnstile,
}) => {
  const { locale, t } = useLanguage();
  // honeypot
  const [website, setWebsite] = useState('');
  const summaryInvalid = Boolean(values.summaryText) && !isConfirmedSummaryText(values.summaryText);
  const hasRequiredTurnstileToken = !turnstile || Boolean(turnstile.token);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return; // bot
    if (!canSubmitHandoff(values) || !hasRequiredTurnstileToken) return;
    onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      company: values.company.trim(),
      message: values.message.trim(),
      summaryText: values.summaryText,
      summaryConfirmed: values.summaryConfirmed,
      privacyConsent: values.privacyConsent,
      griftHandoffConsent: offersGriftHandoff && values.griftHandoffConsent,
    }, turnstile?.token ?? undefined);
  };

  const update = (field: keyof HandoffValues, value: string | boolean) => {
    if (field === 'summaryText' && values.summaryText !== value) turnstile?.onResetRequest();
    onChange(updateHandoffValues(values, field, value, offersGriftHandoff));
  };

  const field =
    'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100';

  return (
    <form onSubmit={handleSubmit} className="safe-area-pad-bottom relative space-y-3 border-t border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">{t('handoffTitle')}</h2>
      <p className="text-xs text-slate-500">{t('handoffHint')}</p>
      <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
        <label className="block space-y-1 text-xs font-medium text-slate-800">
          <span>{t('handoffSummaryLabel')}</span>
          <textarea
            name="summaryText"
            className={field + ' min-h-[104px] bg-white font-normal'}
            value={values.summaryText}
            onChange={(e) => update('summaryText', e.target.value)}
            maxLength={8000}
            required
            disabled={disabled}
            aria-invalid={summaryInvalid}
            aria-describedby={summaryInvalid ? 'handoff-summary-hint handoff-summary-error' : 'handoff-summary-hint'}
          />
        </label>
        <p id="handoff-summary-hint" className="text-xs leading-relaxed text-slate-600">{t('handoffSummaryHint')}</p>
        {summaryInvalid && (
          <p id="handoff-summary-error" className="text-xs font-medium text-red-700" role="alert">
            {t('handoffSummaryTranscriptError')}
          </p>
        )}
        <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-800">
          <input
            type="checkbox"
            name="summaryConfirmed"
            checked={values.summaryConfirmed}
            onChange={(e) => update('summaryConfirmed', e.target.checked)}
            required
            disabled={disabled}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
          />
          <span>{t('handoffSummaryConfirm')}</span>
        </label>
      </div>
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
      <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs leading-relaxed text-slate-600">{t('privacyPurpose')}</p>
        <a
          href={locale === 'ja' ? 'https://cor-jp.com/privacy/' : 'https://cor-jp.com/en/privacy/'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {t('privacyPolicy')}
        </a>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-800">
          <input
            type="checkbox"
            name="privacyConsent"
            checked={values.privacyConsent}
            onChange={(e) => update('privacyConsent', e.target.checked)}
            required
            disabled={disabled}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
          />
          <span>{t('privacyConsent')}</span>
        </label>
      </div>
      {offersGriftHandoff && (
        <fieldset
          className="space-y-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200"
          aria-describedby="grift-handoff-purpose grift-handoff-items grift-handoff-email-only"
        >
          <legend className="text-sm font-medium text-emerald-950">{t('griftHandoffTitle')}</legend>
          <p id="grift-handoff-purpose" className="text-xs leading-relaxed text-emerald-950/80">{t('griftHandoffPurpose')}</p>
          <p id="grift-handoff-items" className="text-xs leading-relaxed text-emerald-950/80">{t('griftTransferItems')}</p>
          <p className="text-xs font-medium leading-relaxed text-emerald-950">{t('griftNoTranscript')}</p>
          <p id="grift-handoff-email-only" className="text-xs leading-relaxed text-emerald-950/80">{t('griftEmailOnly')}</p>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-emerald-950">
            <input
              type="checkbox"
              name="griftHandoffConsent"
              checked={values.griftHandoffConsent}
              onChange={(e) => update('griftHandoffConsent', e.target.checked)}
              disabled={disabled}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-emerald-400 text-emerald-700"
            />
            <span>{t('griftConsent')}</span>
          </label>
        </fieldset>
      )}
      <label className="block space-y-1 text-xs text-slate-700">
        <span>{t('handoffMessage')}</span>
        <textarea className={field + ' min-h-[72px]'} value={values.message} onChange={(e) => update('message', e.target.value)} disabled={disabled} />
      </label>
      {turnstile && (
        <TurnstileWidget
          siteKey={turnstile.siteKey}
          resetSignal={turnstile.resetSignal}
          onTokenChange={turnstile.onTokenChange}
        />
      )}
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
          disabled={disabled || !canSubmitHandoff(values) || !hasRequiredTurnstileToken}
          aria-describedby={turnstile ? 'cloudia-turnstile-status' : undefined}
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
