import { describe, expect, it } from 'vitest';
import {
  classifyReturnTarget,
  entrySourceReturnHref,
  persistReturnTarget,
  readStoredReturnTarget,
  resolveReturnTarget,
  RETURN_LINK_LABEL_KEYS,
  saveReturnTarget,
} from './returnTarget';

const CHAT_URL = 'https://cor-jp.com/contact/chat/';
const CHAT_URL_EN = 'https://cor-jp.com/contact/chat/?locale=en';

describe('resolveReturnTarget', () => {
  it('returns the referrer URL when the visitor came from an allow-listed industry page', () => {
    const { href, save } = resolveReturnTarget('https://cor-jp.com/industries/medical/', CHAT_URL, 'ja', null);
    expect(href).toBe('https://cor-jp.com/industries/medical/');
    expect(save).toBe('https://cor-jp.com/industries/medical/');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget(href)]).toBe('backToPreviousPage');
  });

  it('returns the Grift URL with the Grift label when the visitor came from the Grift site', () => {
    const { href } = resolveReturnTarget('https://griftai.org/', CHAT_URL, 'ja', null);
    expect(href).toBe('https://griftai.org/');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget(href)]).toBe('backToGriftSite');
    expect(classifyReturnTarget(resolveReturnTarget('https://www.griftai.org/', CHAT_URL, 'en', null).href)).toBe('grift');
  });

  it('falls back to the site top when the referrer host is not allow-listed or not https', () => {
    const href = (referrer: string) => resolveReturnTarget(referrer, CHAT_URL, 'ja', null).href;
    expect(href('https://example.com/page/')).toBe('/');
    expect(href('http://griftai.org/')).toBe('/');
    expect(href('https://sub.cor-jp.com.evil.example/')).toBe('/');
  });

  it('ignores a referrer that is the chat itself and uses the source or the top', () => {
    const href = (
      referrer: string,
      currentUrl: string,
      locale: 'ja' | 'en',
    ) => resolveReturnTarget(referrer, currentUrl, locale, null).href;
    expect(
      href(
        'https://cor-jp.com/contact/chat/?intent=contract-dev',
        'https://cor-jp.com/contact/chat/?source=industry-medical',
        'ja',
      ),
    ).toBe('/industries/medical/');
    expect(href('https://cor-jp.com/contact/chat/', CHAT_URL, 'ja')).toBe('/');
    expect(href('https://cor-jp.com/contact/chat/ambassador/', CHAT_URL_EN, 'en')).toBe('/en/');
  });

  it('resolves the industry page from source= when there is no referrer', () => {
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=industry-medical', 'ja', null).href).toBe('/industries/medical/');
    expect(resolveReturnTarget('', 'https://cor-jp.com/contact/chat/?source=industry-manufacturing', 'en', null).href).toBe('/en/industries/manufacturing/');
    expect(resolveReturnTarget(null, CHAT_URL, 'ja', null).href).toBe('/');
  });

  it('maps corsweb-contact-primary to the localized contact page and generic launcher tags to the top', () => {
    const href = (currentUrl: string, locale: 'ja' | 'en') => resolveReturnTarget(null, currentUrl, locale, null).href;
    expect(entrySourceReturnHref(CHAT_URL, 'ja')).toBeNull();
    expect(href('https://cor-jp.com/contact/chat/?source=corsweb-contact-primary', 'ja')).toBe('/contact/');
    expect(href('https://cor-jp.com/contact/chat/?source=corsweb-contact-primary', 'en')).toBe('/en/contact/');
    expect(href('https://cor-jp.com/contact/chat/?source=corsweb-launcher', 'en')).toBe('/en/');
    expect(href('https://cor-jp.com/contact/chat/?source=corsweb-launcher-fallback', 'ja')).toBe('/');
  });

  it('classifies the site top with the Cor. label and unknown paths as a page', () => {
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget('/')]).toBe('backToCorSite');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget('/en/')]).toBe('backToCorSite');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget('/contact/')]).toBe('backToPreviousPage');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget('https://cor-jp.com/industries/medical/')]).toBe('backToPreviousPage');
  });
});

describe('return target storage', () => {
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

  it('keeps the resolved target so a reload can reuse it', () => {
    const storage = memoryStorage();
    expect(readStoredReturnTarget(storage)).toBeNull();
    saveReturnTarget('/industries/medical/', storage);
    expect(readStoredReturnTarget(storage)).toBe('/industries/medical/');
    expect(readStoredReturnTarget(null)).toBeNull();
  });

  it('persists only what the decision says to save, overwriting the previous value', () => {
    const storage = memoryStorage();
    saveReturnTarget('https://cor-jp.com/industries/medical/', storage);
    persistReturnTarget({ href: 'https://cor-jp.com/', save: 'https://cor-jp.com/' }, storage);
    expect(readStoredReturnTarget(storage)).toBe('https://cor-jp.com/');
  });

  it('leaves the stored value untouched when the decision says not to save', () => {
    const storage = memoryStorage();
    saveReturnTarget('https://cor-jp.com/industries/medical/', storage);
    persistReturnTarget({ href: '/', save: null }, storage);
    persistReturnTarget({ href: '/', save: null }, null);
    expect(readStoredReturnTarget(storage)).toBe('https://cor-jp.com/industries/medical/');
  });
});

describe('resolveReturnTarget with the stored value (3-stage decision)', () => {
  const TOP_URL = 'https://cor-jp.com/';
  const MEDICAL_URL = 'https://cor-jp.com/industries/medical/';

  it('(a) a fresh allow-listed referrer wins over the stored target and overwrites it', () => {
    const decision = resolveReturnTarget(TOP_URL, CHAT_URL, 'ja', MEDICAL_URL);
    expect(decision.href).toBe(TOP_URL);
    expect(decision.save).toBe(TOP_URL);
  });

  it('(b) a self-chat navigation keeps using the stored target', () => {
    const decision = resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', MEDICAL_URL);
    expect(decision.href).toBe(MEDICAL_URL);
  });

  it('(c) without a referrer, source= decides and nothing is stored', () => {
    const decision = resolveReturnTarget(
      null,
      'https://cor-jp.com/contact/chat/?source=industry-medical',
      'ja',
      MEDICAL_URL,
    );
    expect(decision.href).toBe('/industries/medical/');
    expect(decision.save).toBeNull();
  });

  it('(d) with no stored value, no referrer and no source, the localized top is used and nothing is stored', () => {
    expect(resolveReturnTarget(null, CHAT_URL, 'ja', null)).toEqual({ href: '/', save: null });
    expect(resolveReturnTarget(null, CHAT_URL_EN, 'en', null)).toEqual({ href: '/en/', save: null });
  });

  it('(e) a stored target that fails the allow-list check is treated as missing', () => {
    const decision = resolveReturnTarget(
      CHAT_URL,
      'https://cor-jp.com/contact/chat/?source=industry-medical',
      'ja',
      'https://example.com/page/',
    );
    expect(decision.href).toBe('/industries/medical/');

    // 相対 path（古い保存値 `/` など）と http も、同じ検査で無い物として扱う。
    expect(resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', '/').href).toBe('/');
    expect(resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', 'http://griftai.org/').href).toBe('/');
  });
});
