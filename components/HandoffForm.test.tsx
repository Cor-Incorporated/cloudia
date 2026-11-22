import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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

describe('HandoffForm', () => {
  it('names the form with its heading and connects the confidentiality notice to the message field', () => {
    const markup = renderForm();

    expect(markup).toContain('aria-labelledby="handoff-title"');
    expect(markup).toMatch(/<h1 id="handoff-title"[^>]*>ご連絡先<\/h1>/);
    expect(markup).toContain('id="handoff-message-hint"');
    expect(markup).toContain('<textarea aria-describedby="handoff-message-hint"');
  });

  it('marks the required fields in their labels', () => {
    const markup = renderForm();

    expect(markup).toContain('お名前（必須）');
    expect(markup).toContain('メールアドレス（必須）');
    expect(markup).toContain('会社名（任意）');
  });

  it('links to the privacy policy next to the hint, before the fields', () => {
    const markup = renderForm();
    const hint = markup.indexOf('担当からのご連絡にのみ使用します。');
    const link = markup.indexOf('href="/privacy/#ai-reception"');
    const firstField = markup.indexOf('お名前（必須）');

    expect(hint).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(hint);
    expect(link).toBeLessThan(firstField);
    expect(markup).toMatch(/<a href="\/privacy\/#ai-reception" target="_blank" rel="noopener noreferrer"/);
  });

  it('puts the submit button before the secondary actions', () => {
    const markup = renderForm();
    const submit = markup.indexOf('問い合わせを送信');
    const back = markup.indexOf('チャットに戻る');
    const cancel = markup.indexOf('会話を中断する');

    expect(submit).toBeGreaterThan(-1);
    expect(submit).toBeLessThan(back);
    expect(back).toBeLessThan(cancel);
    // The first button must also be the one that submits, not just carry its label.
    expect(markup).toMatch(/<button type="submit"[^>]*>問い合わせを送信</);
  });

  it('announces a failed submission beside the submit button', () => {
    const markup = renderForm(true);
    expect(markup).toContain('id="handoff-submit-error" role="alert"');
    expect(markup).toMatch(/<button type="submit" aria-describedby="handoff-submit-error"/);
    expect(markup).toContain('入力内容は残っています。');
    expect(renderForm()).not.toContain('handoff-submit-error');
  });
});
