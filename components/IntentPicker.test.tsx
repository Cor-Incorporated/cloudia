import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import IntentPicker, { resolveIntentSelection } from './IntentPicker';
import { CONTACT_INTENT_DISPLAY_OPTIONS } from '../constants/intents';
import { LanguageProvider } from '../contexts/LanguageContext';

function renderPicker(selected: 'local-llm-poc' | 'grift-paid-trial' | null = null): string {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { search: '' } },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'ja-JP' },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });

  return renderToStaticMarkup(
    <LanguageProvider>
      <IntentPicker selected={selected} onSelect={() => undefined} />
    </LanguageProvider>,
  );
}

describe('IntentPicker', () => {
  it('renders all intents as accessible pressed buttons', () => {
    const markup = renderPicker();

    expect(markup).toContain('<fieldset');
    expect(markup).toContain('ご相談の目的を選んでください');
    expect((markup.match(/aria-pressed=/g) ?? []).length).toBe(5);
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('AI見積もりシステムについて');
  });

  it('marks the selected intent without rendering a second control', () => {
    const markup = renderPicker('local-llm-poc');

    expect(markup).toContain('社内向けAI基盤を試したい');
    expect((markup.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((markup.match(/aria-pressed="false"/g) ?? []).length).toBe(4);
  });

  it('maps legacy Grift intents to the single estimate-system option', () => {
    const markup = renderPicker('grift-paid-trial');

    expect(markup).toContain('AI見積もりシステムについて');
    expect((markup.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((markup.match(/aria-pressed="false"/g) ?? []).length).toBe(4);
  });

  it.each([
    'grift-team-beta',
    'grift-paid-trial',
    'estimate-audit',
  ] as const)('preserves the original Grift LP intent %s when its selected group is pressed', (intent) => {
    const option = CONTACT_INTENT_DISPLAY_OPTIONS.find((candidate) => candidate.id === 'ai-estimate-system');
    if (!option) throw new Error('estimate-system option missing');

    expect(resolveIntentSelection(option, intent)).toBe(intent);
    expect(resolveIntentSelection(option, null)).toBe('estimate-audit');
    expect(resolveIntentSelection(option, intent)).not.toBe('contract-dev');
  });
});
