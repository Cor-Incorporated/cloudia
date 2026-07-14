import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HandoffForm, {
  canSubmitHandoff,
  isConfirmedSummaryText,
  updateHandoffValues,
  type HandoffValues,
} from './HandoffForm';
import { LanguageProvider } from '../contexts/LanguageContext';
import { isGriftHandoffIntent } from '../constants/intents';

const COMPLETE_VALUES: HandoffValues = {
  name: 'Test User',
  email: 'test@example.com',
  company: '',
  message: '',
  summaryText: 'Confirmed summary',
  summaryConfirmed: true,
  privacyConsent: true,
  griftHandoffConsent: true,
};

function renderForm(locale: 'ja' | 'en', offersGriftHandoff = true): string {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { search: `?locale=${locale}` } },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: `${locale}-${locale === 'ja' ? 'JP' : 'US'}` },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined },
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <HandoffForm
        values={COMPLETE_VALUES}
        onChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
        offersGriftHandoff={offersGriftHandoff}
      />
    </LanguageProvider>,
  );
}

describe('HandoffForm', () => {
  it('requires an editable confirmed summary and privacy consent while keeping Grift optional', () => {
    const markup = renderForm('ja');

    expect(markup).toContain('送信前に確認・編集する要約');
    expect(markup).toContain('name="summaryConfirmed"');
    expect(markup).toContain('name="privacyConsent"');
    expect(markup).toContain('name="griftHandoffConsent"');
    expect(markup).toContain('会話の全文はGriftへ送信しません');
    expect(markup).toContain('Griftへの転送と、Griftの利用に同意します');
    expect(markup).toContain('チェックしない場合も、問い合わせはメールで正常に受け付けます');
    expect(markup).toContain('<fieldset');
    expect(canSubmitHandoff(COMPLETE_VALUES)).toBe(true);
    expect(canSubmitHandoff({ ...COMPLETE_VALUES, griftHandoffConsent: false })).toBe(true);
    expect(canSubmitHandoff({ ...COMPLETE_VALUES, privacyConsent: false })).toBe(false);
  });

  it('clears both confirmations after summary editing and requires explicit reconfirmation', () => {
    const edited = updateHandoffValues(
      COMPLETE_VALUES,
      'summaryText',
      'Edited confirmed summary',
      true,
    );

    expect(edited.summaryConfirmed).toBe(false);
    expect(edited.griftHandoffConsent).toBe(false);
    expect(canSubmitHandoff(edited)).toBe(false);

    const summaryReconfirmed = updateHandoffValues(edited, 'summaryConfirmed', true, true);
    expect(canSubmitHandoff(summaryReconfirmed)).toBe(true);
    expect(summaryReconfirmed.griftHandoffConsent).toBe(false);

    const griftReconfirmed = updateHandoffValues(summaryReconfirmed, 'griftHandoffConsent', true, true);
    expect(griftReconfirmed.summaryConfirmed).toBe(true);
    expect(griftReconfirmed.griftHandoffConsent).toBe(true);
  });

  it('always clears a latent Grift consent when the summary changes', () => {
    const edited = updateHandoffValues(
      COMPLETE_VALUES,
      'summaryText',
      'Edited outside the eligible presentation state',
      false,
    );

    expect(edited.summaryConfirmed).toBe(false);
    expect(edited.griftHandoffConsent).toBe(false);
  });

  it('rejects a raw role-labelled transcript as a confirmed summary', () => {
    expect(isConfirmedSummaryText('Project purpose and timing were confirmed.')).toBe(true);
    expect(isConfirmedSummaryText('User: my raw message\nCloudia: a raw reply')).toBe(false);
    expect(canSubmitHandoff({
      ...COMPLETE_VALUES,
      summaryText: '訪問者：生の会話\nCloudia：応答',
    })).toBe(false);
  });

  it('provides the transfer explanation in English', () => {
    const markup = renderForm('en');

    expect(markup).toContain('Review and edit the summary before sending');
    expect(markup).toContain('We do not send the full chat transcript to Grift');
    expect(markup).toContain('I agree to use Grift and transfer the confirmed summary');
    expect(markup).toContain('will still be submitted by email');
  });

  it('does not request Grift transfer consent for other intents', () => {
    const markup = renderForm('ja', false);

    expect(markup).not.toContain('name="griftHandoffConsent"');
    expect(canSubmitHandoff({ ...COMPLETE_VALUES, griftHandoffConsent: false })).toBe(true);
  });

  it.each([
    'contract-dev',
    'grift-team-beta',
    'grift-paid-trial',
    'estimate-audit',
  ] as const)('shows the Grift consent UI for eligible intent %s', (intent) => {
    const markup = renderForm('en', isGriftHandoffIntent(intent));

    expect(markup).toContain('name="griftHandoffConsent"');
  });
});
