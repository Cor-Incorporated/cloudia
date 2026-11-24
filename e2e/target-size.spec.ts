import { test, expect } from '@playwright/test';
import { CLOUDIA_ROUTES, resolveUrl } from './routes';

const MIN_TARGET = 44;

async function clickableTargets(page: import('@playwright/test').Page) {
  return page.evaluate((minTarget) => {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])';
    const visible = [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  return visible.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '',
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }).filter((item) => item.width < minTarget || item.height < minTarget);
  }, MIN_TARGET);
}

for (const cloudiaRoute of CLOUDIA_ROUTES) {
  test(`44px targets — ${cloudiaRoute.id} @390px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(resolveUrl(cloudiaRoute, baseURL!));
    await page.waitForLoadState('networkidle');

    const undersized = await clickableTargets(page);
    expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
  });
}