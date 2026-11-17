import { describe, expect, it } from 'vitest';
import {
  classifyReturnTarget,
  entrySourceReturnHref,
  readStoredReturnTarget,
  resolveReturnTarget,
  RETURN_LINK_LABEL_KEYS,
  saveReturnTarget,
} from './returnTarget';

const CHAT_URL = 'https://cor-jp.com/contact/chat/';
const CHAT_URL_EN = 'https://cor-jp.com/contact/chat/?locale=en';

describe('resolveReturnTarget', () => {
  it('returns the referrer URL when the visitor came from an allow-listed industry page', () => {
    const href = resolveReturnTarget('https://cor-jp.com/industries/medical/', CHAT_URL, 'ja');
    expect(href).toBe('https://cor-jp.com/industries/medical/');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget(href)]).toBe('backToPreviousPage');
  });

  it('returns the Grift URL with the Grift label when the visitor came from the Grift site', () => {
    const href = resolveReturnTarget('https://griftai.org/', CHAT_URL, 'ja');
    expect(href).toBe('https://griftai.org/');
    expect(RETURN_LINK_LABEL_KEYS[classifyReturnTarget(href)]).toBe('backToGriftSite');
    expect(classifyReturnTarget(resolveReturnTarget('https://www.griftai.org/', CHAT_URL, 'en'))).toBe('grift');
  });

  it('falls back to the site top when the referrer host is not allow-listed or not https', () => {
    expect(resolveReturnTarget('https://example.com/page/', CHAT_URL, 'ja')).toBe('/');
    expect(resolveReturnTarget('http://griftai.org/', CHAT_URL, 'ja')).toBe('/');
    expect(resolveReturnTarget('https://sub.cor-jp.com.evil.example/', CHAT_URL, 'ja')).toBe('/');
  });

  it('ignores a referrer that is the chat itself and uses the source or the top', () => {
    expect(
      resolveReturnTarget(
        'https://cor-jp.com/contact/chat/?intent=contract-dev',
        'https://cor-jp.com/contact/chat/?source=industry-medical',
        'ja',
      ),
    ).toBe('/industries/medical/');
    expect(resolveReturnTarget('https://cor-jp.com/contact/chat/', CHAT_URL, 'ja')).toBe('/');
    expect(resolveReturnTarget('https://cor-jp.com/contact/chat/ambassador/', CHAT_URL_EN, 'en')).toBe('/en/');
  });

  it('resolves the industry page from source= when there is no referrer', () => {
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=industry-medical', 'ja')).toBe('/industries/medical/');
    expect(resolveReturnTarget('', 'https://cor-jp.com/contact/chat/?source=industry-manufacturing', 'en')).toBe('/en/industries/manufacturing/');
    expect(resolveReturnTarget(null, CHAT_URL, 'ja')).toBe('/');
  });

  it('maps corsweb-contact-primary to the localized contact page and generic launcher tags to the top', () => {
    expect(entrySourceReturnHref(CHAT_URL, 'ja')).toBeNull();
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=corsweb-contact-primary', 'ja')).toBe('/contact/');
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=corsweb-contact-primary', 'en')).toBe('/en/contact/');
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=corsweb-launcher', 'en')).toBe('/en/');
    expect(resolveReturnTarget(null, 'https://cor-jp.com/contact/chat/?source=corsweb-launcher-fallback', 'ja')).toBe('/');
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
});
