import { describe, expect, it } from 'vitest';
import {
  SITE_CHROME,
  SITE_CHROME_LOCALES,
  commonLinksFor,
  siteChromeYear,
} from './siteChrome';

describe('siteChrome data', () => {
  it('keeps version 2 and the three canonical common link ids', () => {
    expect(SITE_CHROME.version).toBe(2);
    expect(SITE_CHROME.commonLinks.map((link) => link.id)).toEqual(['privacy', 'tokushoho', 'security']);
    expect(new Set(SITE_CHROME.commonLinks.map((link) => link.id)).size).toBe(SITE_CHROME.commonLinks.length);
  });

  it('holds the organization name for all five languages', () => {
    expect(SITE_CHROME_LOCALES).toEqual(['ja', 'en', 'zh', 'ko', 'es']);
    for (const locale of SITE_CHROME_LOCALES) {
      expect(SITE_CHROME.organization[locale], `organization.${locale}`).toBeTruthy();
    }
    expect(SITE_CHROME.organization.ja).toBe('Cor.株式会社');
    expect(SITE_CHROME.organization.en).toBe('Cor.Inc.');
  });

  it('has non-empty labels and https, trailing-slash hrefs for all five languages', () => {
    for (const link of SITE_CHROME.commonLinks) {
      for (const locale of SITE_CHROME_LOCALES) {
        expect(link.label[locale], `${link.id}.${locale} label`).toBeTruthy();
        expect(link.href[locale], `${link.id}.${locale}`).toMatch(/^https:\/\//);
        expect(link.href[locale].endsWith('/'), `${link.id}.${locale} trailing slash`).toBe(true);
      }
    }
  });

  it('lists the three sites with unique ids and hrefs', () => {
    expect(SITE_CHROME.sites.map((site) => site.id)).toEqual(['cor', 'grift', 'cloudia']);
    expect(new Set(SITE_CHROME.sites.map((site) => site.href)).size).toBe(SITE_CHROME.sites.length);
    for (const site of SITE_CHROME.sites) {
      expect(site.label.length).toBeGreaterThan(0);
      expect(site.href).toMatch(/^https:\/\//);
    }
  });

  it('has no terms link while corsweb has no terms page', () => {
    const all = [
      ...SITE_CHROME.commonLinks.flatMap((link) =>
        SITE_CHROME_LOCALES.flatMap((locale) => [link.label[locale], link.href[locale]]),
      ),
      ...SITE_CHROME.sites.map((site) => site.href),
    ].join(' ');

    expect(all).not.toMatch(/利用規約/);
    expect(all).not.toMatch(/terms/i);
  });

  it('returns the common links for the requested locale in JSON order', () => {
    expect(commonLinksFor('ja').map((link) => link.label)).toEqual(['プライバシー', '特定商取引法表記', 'セキュリティ']);
    expect(commonLinksFor('en').map((link) => link.label)).toEqual(['Privacy', 'Legal Notice', 'Security']);
    expect(commonLinksFor('zh').map((link) => link.href)).toEqual([
      'https://cor-jp.com/zh/privacy/',
      'https://cor-jp.com/zh/legal/tokushoho/',
      'https://cor-jp.com/zh/security/',
    ]);
    expect(commonLinksFor('ko')).toHaveLength(3);
    expect(commonLinksFor('es')).toHaveLength(3);
  });

  it('takes the year from the clock, not from a constant', () => {
    expect(siteChromeYear(new Date('2026-05-01T00:00:00Z'))).toBe(2026);
    expect(siteChromeYear(new Date('2031-01-01T00:00:00Z'))).toBe(2031);
  });
});
