import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HandoffForm from './HandoffForm';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderForm(): string {
  vi.stubGlobal('window', { location: { search: '' } });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <HandoffForm
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
  it('marks the required fields in their labels', () => {
    const markup = renderForm();

    expect(markup).toContain('お名前（必須）');
    expect(markup).toContain('メールアドレス（必須）');
    expect(markup).toContain('会社名（任意）');
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
});
