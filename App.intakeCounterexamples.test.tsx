import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { translations } from './translations';
import { CONTACT_INTENT_DISPLAY_OPTIONS, CONTACT_INTENT_KEYS, isContractDevHandoffIntent, parseContactIntent } from './constants/intents';
import { INDUSTRY_ENTRY_SOURCES, isIndustryEntrySource, parseEntrySourceFromSearch } from './constants/entrySources';
import { industryQuestion } from './constants/industryGuidance';
import { industryEntryLocale } from './utils/contactLocale';

/**
 * Counterexample probes for the Cloudia intake.
 *
 * These are assertions about what the current public/candidate behaviour must
 * NOT do. They are deliberately narrow: no recipient, no intent key, and no
 * data-contract change is introduced here.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

function stubBrowser({ search = '', referrer = '' }: { search?: string; referrer?: string } = {}) {
  vi.stubGlobal('window', {
    location: {
      search,
      href: `https://cor-jp.com/contact/chat/${search}`,
      hostname: 'cor-jp.com',
      pathname: '/contact/chat/',
    },
    sessionStorage: memoryStorage(),
    confirm: () => true,
  });
  vi.stubGlobal('navigator', { language: 'ja-JP' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  vi.stubGlobal('document', { referrer, title: '' });
}

function renderApp(): string {
  const initialLocale = typeof window !== 'undefined' ? industryEntryLocale(window.location.search) : null;
  return renderToStaticMarkup(
    <LanguageProvider initialLocale={initialLocale}>
      <App />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('general consultation opened from the footer', () => {
  const genericEntries = [
    '',
    '?source=corsweb-contact-primary',
    '?source=corsweb-launcher',
    '?source=corsweb-launcher-fallback',
    '?source=footer-calendar',
    '?source=unknown-tag',
  ];

  it.each(genericEntries)('does not attach an industry for %s', (search) => {
    stubBrowser({ search });
    const markup = renderApp();

    expect(isIndustryEntrySource(parseEntrySourceFromSearch(search))).toBe(false);
    expect(markup).toContain(translations.ja.welcomeMessage);
    expect(markup).toContain(translations.ja.piiNotice);
    for (const source of INDUSTRY_ENTRY_SOURCES) {
      expect(markup, `${source} の問いが混ざっている`).not.toContain(industryQuestion(source, 'ja'));
    }
  });

  it('does not infer an industry from the referrer when the footer link carries no source', () => {
    // A footer click from an industry page sends the industry page as referrer,
    // but the footer link itself is the generic /contact/chat/ URL.
    stubBrowser({ search: '', referrer: 'https://cor-jp.com/industries/medical/' });
    const markup = renderApp();

    expect(markup).toContain(translations.ja.welcomeMessage);
    expect(markup).not.toContain(industryQuestion('industry-medical', 'ja'));
  });
});

describe('existing contractor is not auto-routed to contract-dev', () => {
  it('keeps the seven canonical intent keys and offers no extra intent', () => {
    expect(CONTACT_INTENT_KEYS).toEqual([
      'confidential-ai-assessment',
      'local-llm-poc',
      'grift-team-beta',
      'grift-paid-trial',
      'estimate-audit',
      'contract-dev',
      'press-speaking-other',
    ]);
    expect(CONTACT_INTENT_DISPLAY_OPTIONS.map((option) => option.primaryIntent)).toEqual([
      'confidential-ai-assessment',
      'local-llm-poc',
      'grift-team-beta',
      'contract-dev',
      'press-speaking-other',
    ]);
  });

  it('selects no intent for a generic or industry entry without intent=', () => {
    for (const search of ['', '?source=corsweb-contact-primary', '?source=industry-medical']) {
      stubBrowser({ search });
      const markup = renderApp();
      const intent = parseContactIntent(new URLSearchParams(search).get('intent'));

      const picker = markup.slice(markup.indexOf('<fieldset'), markup.indexOf('</fieldset>') + 1);
      expect(intent, search).toBeNull();
      expect(picker, search).not.toContain('aria-pressed="true"');
      expect(picker.match(/aria-pressed="false"/g)?.length, search).toBe(CONTACT_INTENT_DISPLAY_OPTIONS.length);
    }
  });

  it('reaches contract-dev only through an explicit intent= query', () => {
    stubBrowser({ search: '?source=industry-medical&intent=contract-dev' });
    const markup = renderApp();

    expect(parseContactIntent('contract-dev')).toBe('contract-dev');
    expect(isContractDevHandoffIntent('contract-dev')).toBe(true);
    expect(isContractDevHandoffIntent(null)).toBe(false);
    expect(markup).toContain('aria-pressed="true"');
  });
});

describe('contractor entry and brochure request', () => {
  it.each([
    '?locale=ja',
    '?source=corsweb-contact-primary&locale=ja',
    '?source=footer&locale=ja',
    '?source=header-quick&locale=ja',
    '?source=company&locale=ja',
    '?embed=1&source=corsweb-launcher&locale=ja',
    '?source=corsweb-launcher-fallback&locale=ja',
    '?source=not-a-known-source&locale=ja',
  ])('offers an explicit contract inquiry on each general entry: %s', (search) => {
    stubBrowser({ search });
    const markup = renderApp();

    expect(markup).toContain('data-testid="contractor-inquiry"');
    expect(markup).toContain('契約中のサービスについて問い合わせる');
    expect(markup).toContain('aria-labelledby="contractor-inquiry-title"');
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>契約中のサービスについて問い合わせる<\/button>/);
    // The existing five choices stay available as the other path.
    const picker = markup.slice(markup.indexOf('<fieldset'), markup.indexOf('</fieldset>') + 1);
    expect(picker.match(/aria-pressed="false"/g)).toHaveLength(CONTACT_INTENT_DISPLAY_OPTIONS.length);
  });

  it.each([
    '?source=industry-medical',
    '?source=industry-shigyo',
    '?source=industry-construction',
    '?source=industry-manufacturing',
    '?source=industry-education',
  ])('does not leak the contractor copy for %s', (search) => {
    stubBrowser({ search });
    const markup = renderApp();

    expect(markup).not.toContain('data-testid="contractor-inquiry"');
    expect(markup).not.toContain('契約中のサービスについて問い合わせる');
    expect(markup).not.toContain('ご契約中のサービスについて');
  });

  it('does not show the contractor prompt when an intent is explicit', () => {
    stubBrowser({ search: '?source=corsweb-contact-primary&intent=contract-dev' });
    const markup = renderApp();

    expect(markup).not.toContain('data-testid="contractor-inquiry"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('links a general entry without an industry to the confirmed same-origin form', () => {
    stubBrowser({ search: '?source=corsweb-contact-primary&locale=ja' });
    const ja = renderApp();
    expect(ja).toContain('href="https://cor-jp.com/contact/materials/"');
    expect(ja).toContain('会社紹介資料の請求');
    expect(ja).not.toContain('href="https://cor-jp.com/contact/materials/" target="_top"');

    stubBrowser({ search: '?locale=en' });
    const en = renderApp();
    expect(en).toContain('href="https://cor-jp.com/en/contact/materials/"');
    expect(en).toContain('Request our company brochure');
  });

  it.each(['es', 'ko', 'zh'])('keeps the requested form language %s when chat uses English', (locale) => {
    stubBrowser({ search: '?source=footer&locale=' + locale });
    expect(renderApp()).toContain('href="https://cor-jp.com/' + locale + '/contact/materials/"');
  });

  it('opens the brochure request in the top window from an embed', () => {
    stubBrowser({ search: '?embed=1&source=corsweb-contact-primary&locale=ja' });
    const markup = renderApp();

    expect(markup).toContain('href="https://cor-jp.com/contact/materials/" target="_top"');
  });

  it('does not offer the brochure request on an industry page', () => {
    stubBrowser({ search: '?source=industry-medical&locale=ja' });
    const markup = renderApp();

    expect(markup).not.toContain('/contact/materials/');
    expect(markup).not.toContain('会社紹介資料の請求');
  });
});
