import { describe, expect, it } from 'vitest';
import {
  ALLOWED_RETURN_HOSTS,
  classifyReturnTarget,
  entrySourceReturnHref,
  persistReturnTarget,
  readStoredReturnTarget,
  resolveReturnTarget,
  RETURN_LINK_LABEL_KEYS,
  RETURN_TARGET_STORAGE_KEY,
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
    persistReturnTarget({ href: 'https://cor-jp.com/', save: 'https://cor-jp.com/', clear: false }, storage);
    expect(readStoredReturnTarget(storage)).toBe('https://cor-jp.com/');
  });

  it('leaves the stored value untouched when the decision says not to save', () => {
    const storage = memoryStorage();
    saveReturnTarget('https://cor-jp.com/industries/medical/', storage);
    persistReturnTarget({ href: '/', save: null, clear: false }, storage);
    persistReturnTarget({ href: '/', save: null, clear: false }, null);
    expect(readStoredReturnTarget(storage)).toBe('https://cor-jp.com/industries/medical/');
  });

  it('removes the stored value when the decision says to clear', () => {
    const storage = memoryStorage();
    saveReturnTarget('https://cor-jp.com/industries/shigyo/', storage);
    persistReturnTarget({ href: '/industries/medical/', save: null, clear: true }, storage);
    expect(readStoredReturnTarget(storage)).toBeNull();
    expect(storage.getItem(RETURN_TARGET_STORAGE_KEY)).toBeNull();
  });
});

describe('resolveReturnTarget with the stored value (3-stage decision)', () => {
  const TOP_URL = 'https://cor-jp.com/';
  const MEDICAL_URL = 'https://cor-jp.com/industries/medical/';
  const SHIGYO_URL = 'https://cor-jp.com/industries/shigyo/';

  it('(a) a fresh allow-listed referrer wins over the stored target and overwrites it', () => {
    const decision = resolveReturnTarget(TOP_URL, CHAT_URL, 'ja', MEDICAL_URL);
    expect(decision.href).toBe(TOP_URL);
    expect(decision.save).toBe(TOP_URL);
    expect(decision.clear).toBe(false);
  });

  it('(b) a self-chat navigation keeps using the stored target', () => {
    const decision = resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', MEDICAL_URL);
    expect(decision.href).toBe(MEDICAL_URL);
    expect(decision.clear).toBe(false);
  });

  it('(c) without a referrer, source= decides even when a different page was stored', () => {
    const decision = resolveReturnTarget(
      null,
      'https://cor-jp.com/contact/chat/?source=industry-medical',
      'ja',
      SHIGYO_URL,
    );
    expect(decision.href).toBe('/industries/medical/');
    expect(decision.save).toBeNull();
    expect(decision.clear).toBe(true);
  });

  it('(d) with no stored value, no referrer and no source, the localized top is used and nothing is stored', () => {
    expect(resolveReturnTarget(null, CHAT_URL, 'ja', null)).toEqual({ href: '/', save: null, clear: true });
    expect(resolveReturnTarget(null, CHAT_URL_EN, 'en', null)).toEqual({ href: '/en/', save: null, clear: true });
  });

  it('(e) a stored target that fails the allow-list check is treated as missing', () => {
    const decision = resolveReturnTarget(
      CHAT_URL,
      'https://cor-jp.com/contact/chat/?source=industry-medical',
      'ja',
      'https://example.com/page/',
    );
    expect(decision.href).toBe('/industries/medical/');
    expect(decision.clear).toBe(true);

    // 相対 path（古い保存値 `/` など）と http も、同じ検査で無い物として扱う。
    expect(resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', '/').href).toBe('/');
    expect(resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', 'http://griftai.org/').href).toBe('/');
  });

  it('marks only the third stage as clearing the stored value', () => {
    // 1 段目（許した host の referrer）は上書き、2 段目（chat 自身）はそのまま。
    expect(resolveReturnTarget(TOP_URL, CHAT_URL, 'ja', MEDICAL_URL).clear).toBe(false);
    expect(resolveReturnTarget(CHAT_URL, CHAT_URL, 'ja', MEDICAL_URL).clear).toBe(false);
    // 3 段目（referrer 無し・一覧外）は消す。
    expect(resolveReturnTarget(null, CHAT_URL, 'ja', MEDICAL_URL).clear).toBe(true);
    expect(resolveReturnTarget('https://evil.example/', CHAT_URL, 'ja', MEDICAL_URL).clear).toBe(true);
  });
});

describe('allow-listed return hosts', () => {
  it('pins the list to exactly the four site hosts', () => {
    expect([...ALLOWED_RETURN_HOSTS]).toEqual(['cor-jp.com', 'www.cor-jp.com', 'griftai.org', 'www.griftai.org']);
  });
});
