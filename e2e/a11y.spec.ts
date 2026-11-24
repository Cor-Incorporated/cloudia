import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CLOUDIA_ROUTES, resolveUrl } from './routes';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'];

function blockingViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations.filter(
    (violation) =>
      violation.impact === 'critical'
      || violation.impact === 'serious'
      || (violation.impact === 'moderate' && violation.id === 'target-size'),
  );
}

for (const cloudiaRoute of CLOUDIA_ROUTES) {
  test(`axe WCAG 2.2 AA — ${cloudiaRoute.id}`, async ({ page, baseURL }) => {
    await page.goto(resolveUrl(cloudiaRoute, baseURL!));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).not.toBeEmpty();

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(
      blockingViolations(results.violations),
      JSON.stringify(blockingViolations(results.violations), null, 2),
    ).toEqual([]);
  });
}

test('keyboard reaches primary controls on intake', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(resolveUrl(CLOUDIA_ROUTES[0], baseURL!));
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press('Tab');
  }
  const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(tag);
});

test('visible focus ring on language switch (mobile)', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(resolveUrl({ id: 'intake-ja', path: '/', search: '' }, baseURL!));
  const en = page.getByRole('button', { name: 'English' });
  await en.focus();
  await expect(en).toBeFocused();
  const outlineWidth = await en.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outlineWidth).not.toBe('0px');
});