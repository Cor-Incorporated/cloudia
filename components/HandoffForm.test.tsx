import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandoffForm from './HandoffForm';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderForm(submitFailed = false): string {
  vi.stubGlobal('window', { location: { search: '' } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <HandoffForm
        submitFailed={submitFailed}
        values={{ name: '', email: '', company: '', message: '' }}
        onChange={() => undefined}
        onBack={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />
    </LanguageProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('HandoffForm', () => {
  it('names the form with its heading and connects the confidentiality notice to the message field', () => {
    const markup = renderForm();

    expect(markup).toContain('aria-labelledby="handoff-title"');
    expect(markup).toMatch(/<h1 id="handoff-title"[^>]*>お問い合わせ内容の確認<\/h1>/);
    expect(markup).toContain('id="handoff-message-hint"');
    expect(markup).toContain('<textarea aria-describedby="handoff-message-hint"');
  });

  it('starts with the required inquiry and waits to collect contact information', () => {
    const markup = renderForm();

    expect(markup).toContain('お問い合わせ内容（必須）');
    expect(markup).toMatch(/<textarea[^>]+required/);
    expect(markup).toContain('担当者に引き継ぐ内容を確認');
    expect(markup).not.toContain('お名前（必須）');
    expect(markup).not.toContain('メールアドレス（必須）');
    expect(markup).not.toContain('問い合わせを送信');
  });

  it('puts the next step before the secondary actions', () => {
    const markup = renderForm();
    const submit = markup.indexOf('内容を確認して連絡先へ進む');
    const back = markup.indexOf('チャットに戻る');
    const cancel = markup.indexOf('会話を中断する');

    expect(submit).toBeGreaterThan(-1);
    expect(submit).toBeLessThan(back);
    expect(back).toBeLessThan(cancel);
    // The first button must also be the one that submits, not just carry its label.
    expect(markup).toMatch(/<button type="submit"[^>]*>内容を確認して連絡先へ進む</);
  });

  it('announces a failed submission beside the submit button', () => {
    const markup = renderForm(true);
    expect(markup).toContain('id="handoff-submit-error" role="alert"');
    expect(markup).toMatch(/<button type="submit" aria-describedby="handoff-submit-error"/);
    expect(markup).toContain('入力内容は残っています。');
    expect(renderForm()).not.toContain('handoff-submit-error');
  });
});
