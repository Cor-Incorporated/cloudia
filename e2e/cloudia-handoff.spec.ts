import AxeBuilder from '@axe-core/playwright';
import { expect, test, type FrameLocator, type Page, type Route } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';
const PARENT_URL = `${BASE_URL}/e2e/embed-parent.html`;
const PORTAL_URL = 'https://app.griftai.org/chat/portal/opaque-token_123.~';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_ENABLED = Boolean(process.env.VITE_TURNSTILE_SITE_KEY?.trim());
const FAKE_TURNSTILE_API = String.raw`
  (() => {
    const widgets = new Map();
    const manual = new URL(window.location.href).searchParams.has('turnstileManual');
    let sequence = 0;
    const latest = () => Array.from(widgets.values()).at(-1);
    const complete = (token = 'turnstile-e2e-token') => {
      const widget = latest();
      if (widget) widget.options.callback(token);
    };
    const state = {
      renderCount: 0,
      resetCount: 0,
      removeCount: 0,
      sizes: [],
      complete,
      expire: () => latest()?.options['expired-callback'](),
      fail: () => latest()?.options['error-callback'](),
      timeout: () => latest()?.options['timeout-callback'](),
    };
    Object.defineProperty(window, '__turnstileTest', { value: state, configurable: true });
    window.turnstile = {
      ready(callback) { callback(); },
      render(container, options) {
        const id = 'cloudia-turnstile-' + (++sequence);
        const marker = document.createElement('div');
        marker.setAttribute('role', 'group');
        marker.setAttribute('aria-label', 'Turnstile test widget');
        marker.textContent = 'Turnstile test widget';
        container.replaceChildren(marker);
        widgets.set(id, { container, options });
        state.renderCount += 1;
        state.sizes.push(options.size);
        if (!manual) window.setTimeout(() => complete('turnstile-e2e-token-' + sequence), 0);
        return id;
      },
      reset(id) {
        if (!widgets.has(id)) return;
        state.resetCount += 1;
        if (!manual) window.setTimeout(() => complete('turnstile-e2e-reset-token-' + state.resetCount), 0);
      },
      remove(id) {
        const widget = widgets.get(id);
        if (!widget) return;
        widget.container.replaceChildren();
        widgets.delete(id);
        state.removeCount += 1;
      },
    };
  })();
`;
const ELIGIBLE_CASES = [
  { intent: 'contract-dev', source: 'header-ai-dev', locale: 'ja' },
  { intent: 'grift-team-beta', source: 'grift-lp-hero', locale: 'en' },
  { intent: 'grift-paid-trial', source: 'grift-pricing', locale: 'ja' },
  { intent: 'estimate-audit', source: 'estimate-cta', locale: 'en' },
] as const;

type Scope = Page | FrameLocator;
type JsonObject = Record<string, unknown>;

test.beforeEach(async ({ page }) => {
  if (!TURNSTILE_ENABLED) return;
  await page.route(TURNSTILE_SCRIPT_URL, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript; charset=utf-8',
      body: FAKE_TURNSTILE_API,
    });
  });
});

function futureExpiry(offsetMs = 60 * 60 * 1000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body),
  });
}

function readJsonRequest(route: Route): JsonObject {
  return JSON.parse(route.request().postData() || '{}') as JsonObject;
}

async function installReadyStart(
  page: Page,
  requests: JsonObject[] = [],
  sessionId = 'session-e2e',
): Promise<void> {
  await page.route('**/api/contact/chat/start', async (route) => {
    requests.push(readJsonRequest(route));
    await fulfillJson(route, {
      reply: 'The intake is ready for contact.',
      classification: 'genuine',
      readyForContact: true,
      stage: 'ready',
      sessionId,
      summary: 'Confirmed project scope, timing, and estimate goals.',
      structuredLead: {
        purpose: 'Cloudia browser handoff verification',
        stage: 'ready',
      },
    });
  });
}

async function openHandoffForm(scope: Scope): Promise<void> {
  const openButton = scope.locator('button').filter({
    hasText: /Proceed to submit contact details|連絡先の入力に進む/,
  });
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(scope.locator('textarea[name="summaryText"]')).toBeVisible();
}

async function fillHandoffForm(scope: Scope, griftConsent = true): Promise<void> {
  await scope.locator('input[autocomplete="name"]').fill('Cloudia E2E User');
  await scope.locator('input[autocomplete="email"]').fill('cloudia-e2e@example.com');
  await scope.locator('input[autocomplete="organization"]').fill('Cor E2E');
  await scope.locator('textarea').last().fill('Browser-level handoff verification.');
  await scope.locator('input[name="summaryConfirmed"]').check();
  await scope.locator('input[name="privacyConsent"]').check();
  if (griftConsent) await scope.locator('input[name="griftHandoffConsent"]').check();
}

function embedParentMarkup(childUrl: string, referrerPolicy = ''): string {
  return `<!doctype html>
    <html lang="en">
      <body>
        <iframe id="cloudia" title="Cloudia handoff test" src="${childUrl}" ${referrerPolicy ? `referrerpolicy="${referrerPolicy}"` : ''} style="width:390px;height:700px"></iframe>
        <script>
          window.__cloudiaMessages = [];
          window.addEventListener('message', (event) => {
            const frame = document.getElementById('cloudia');
            window.__cloudiaMessages.push({
              data: event.data,
              origin: event.origin,
              sourceIsFrame: event.source === frame.contentWindow,
            });
          });
        </script>
      </body>
    </html>`;
}

test.describe('eligible Cloudia to Grift handoff', () => {
  for (const handoffCase of ELIGIBLE_CASES) {
    test(`preserves ${handoffCase.intent} context and navigates in standalone mode`, async ({ page }) => {
      const startRequests: JsonObject[] = [];
      const submitRequests: JsonObject[] = [];
      const expiresAt = futureExpiry();
      await installReadyStart(page, startRequests, `session-${handoffCase.intent}`);
      await page.route('**/api/contact/submit', async (route) => {
        submitRequests.push(readJsonRequest(route));
        await fulfillJson(route, {
          ok: true,
          receiptId: `receipt-${handoffCase.intent}`,
          status: 'queued',
          handoff: { status: 'ready', url: PORTAL_URL, expiresAt },
        }, 202);
      });
      await page.route('https://app.griftai.org/**', async (route) => {
        await route.fulfill({ contentType: 'text/html', body: '<title>Grift portal E2E</title>' });
      });

      await page.goto(`/?intent=${handoffCase.intent}&source=${handoffCase.source}&locale=${handoffCase.locale}`);
      await openHandoffForm(page);

      const submitButton = page.locator('button[type="submit"]');
      await expect(page.locator('input[name="griftHandoffConsent"]')).toBeVisible();
      await expect(page.locator('input[name="summaryConfirmed"]')).not.toBeChecked();
      await expect(page.locator('input[name="griftHandoffConsent"]')).not.toBeChecked();
      await expect(submitButton).toBeDisabled();

      await fillHandoffForm(page);
      await expect(submitButton).toBeEnabled();
      await Promise.all([
        page.waitForURL(PORTAL_URL),
        submitButton.click(),
      ]);

      expect(startRequests).toHaveLength(1);
      expect(startRequests[0]).toMatchObject({
        intent: handoffCase.intent,
        source: handoffCase.source,
        locale: handoffCase.locale,
      });
      expect(submitRequests).toHaveLength(1);
      expect(submitRequests[0]).toMatchObject({
        intent: handoffCase.intent,
        source: handoffCase.source,
        locale: handoffCase.locale,
        idempotencyKey: expect.any(String),
        summaryText: {
          intent: handoffCase.intent,
          locale: handoffCase.locale,
          text: 'Confirmed project scope, timing, and estimate goals.',
        },
        handoffConsent: {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: expect.any(String),
          summaryConfirmed: true,
        },
      });
      await expect(page).toHaveTitle('Grift portal E2E');
    });

    test(`posts the exact ${handoffCase.intent} handoff to the trusted embed parent`, async ({ page }) => {
      const submitRequests: JsonObject[] = [];
      const expiresAt = futureExpiry();
      const childUrl = `${BASE_URL}/?embed=1&intent=${handoffCase.intent}&source=${handoffCase.source}&locale=${handoffCase.locale}`;
      await page.route(PARENT_URL, async (route) => {
        await route.fulfill({ contentType: 'text/html', body: embedParentMarkup(childUrl) });
      });
      await installReadyStart(page, [], `embed-session-${handoffCase.intent}`);
      await page.route('**/api/contact/submit', async (route) => {
        submitRequests.push(readJsonRequest(route));
        await fulfillJson(route, {
          ok: true,
          status: 'queued',
          handoff: { status: 'ready', url: PORTAL_URL, expiresAt },
        });
      });

      await page.goto(PARENT_URL, { waitUntil: 'domcontentloaded' });
      const cloudia = page.frameLocator('#cloudia');
      await openHandoffForm(cloudia);
      await fillHandoffForm(cloudia);
      await cloudia.locator('button[type="submit"]').click();

      await expect.poll(async () => page.evaluate(() => (
        (window as typeof window & { __cloudiaMessages?: unknown[] }).__cloudiaMessages?.length ?? 0
      ))).toBe(1);
      const messages = await page.evaluate(() => (
        (window as typeof window & { __cloudiaMessages?: unknown[] }).__cloudiaMessages ?? []
      ));
      expect(messages).toEqual([{
        data: {
          type: 'cloudia:grift-handoff-ready',
          url: PORTAL_URL,
          expiresAt,
        },
        origin: BASE_URL,
        sourceIsFrame: true,
      }]);
      expect(page.url()).toBe(PARENT_URL);
      expect(submitRequests[0]).toMatchObject({
        intent: handoffCase.intent,
        source: handoffCase.source,
        locale: handoffCase.locale,
      });
    });
  }

  test('ignores a malicious ready response when the visitor did not consent to Grift', async ({ page }) => {
    let portalRequests = 0;
    let submittedBody: JsonObject | undefined;
    await installReadyStart(page);
    await page.route('**/api/contact/submit', async (route) => {
      submittedBody = readJsonRequest(route);
      await fulfillJson(route, {
        ok: true,
        status: 'queued',
        handoff: { status: 'ready', url: PORTAL_URL, expiresAt: futureExpiry() },
      });
    });
    await page.route('https://app.griftai.org/**', async (route) => {
      portalRequests += 1;
      await route.abort();
    });

    await page.goto('/?intent=contract-dev&source=consent-negative&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page, false);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Thank you. Your inquiry has been submitted.')).toBeVisible();
    expect(submittedBody).not.toHaveProperty('handoffConsent');
    expect(portalRequests).toBe(0);
    expect(page.url()).toContain('intent=contract-dev');
  });
});

test.describe('portal URL and expiry security', () => {
  const invalidHandoffs = [
    {
      name: 'untrusted origin',
      url: 'https://evil.example/chat/portal/opaque-token',
      expiresAt: () => futureExpiry(),
    },
    {
      name: 'trailing slash path variant',
      url: `${PORTAL_URL}/`,
      expiresAt: () => futureExpiry(),
    },
    {
      name: 'query open redirect',
      url: `${PORTAL_URL}?next=https://evil.example`,
      expiresAt: () => futureExpiry(),
    },
    {
      name: 'expired portal',
      url: PORTAL_URL,
      expiresAt: () => new Date(Date.now() - 1_000).toISOString(),
    },
    {
      name: 'TTL beyond 24 hours',
      url: PORTAL_URL,
      expiresAt: () => futureExpiry(24 * 60 * 60 * 1000 + 60_000),
    },
    {
      name: 'invalid expiry',
      url: PORTAL_URL,
      expiresAt: () => 'not-a-date',
    },
  ];

  for (const invalid of invalidHandoffs) {
    test(`falls back for ${invalid.name}`, async ({ page }) => {
      let portalRequests = 0;
      await installReadyStart(page);
      await page.route('**/api/contact/submit', async (route) => {
        await fulfillJson(route, {
          ok: true,
          status: 'queued',
          handoff: {
            status: 'ready',
            url: invalid.url,
            expiresAt: invalid.expiresAt(),
          },
        });
      });
      await page.route('https://app.griftai.org/**', async (route) => {
        portalRequests += 1;
        await route.fulfill({ contentType: 'text/html', body: '<title>Must not navigate</title>' });
      });

      await page.goto('/?intent=contract-dev&source=security-matrix&locale=en');
      const originalUrl = page.url();
      await openHandoffForm(page);
      await fillHandoffForm(page);
      await page.locator('button[type="submit"]').click();

      await expect(page.getByText(/Grift is currently unavailable/)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Continue in Grift' })).toHaveCount(0);
      expect(portalRequests).toBe(0);
      expect(page.url()).toBe(originalUrl);
    });
  }

  test('does not disclose the portal message to an untrusted embed parent', async ({ page }) => {
    const evilParent = `${BASE_URL}/e2e/no-referrer-parent.html`;
    const childUrl = `${BASE_URL}/?embed=1&intent=contract-dev&source=untrusted-parent&locale=en`;
    await page.route(evilParent, async (route) => {
      await route.fulfill({ contentType: 'text/html', body: embedParentMarkup(childUrl, 'no-referrer') });
    });
    await installReadyStart(page);
    await page.route('**/api/contact/submit', async (route) => {
      await fulfillJson(route, {
        ok: true,
        status: 'queued',
        handoff: { status: 'ready', url: PORTAL_URL, expiresAt: futureExpiry() },
      });
    });

    await page.goto(evilParent, { waitUntil: 'domcontentloaded' });
    const cloudia = page.frameLocator('#cloudia');
    await openHandoffForm(cloudia);
    await fillHandoffForm(cloudia);
    await cloudia.locator('button[type="submit"]').click();
    await expect(cloudia.getByRole('link', { name: 'Continue in Grift' })).toBeVisible();

    await expect.poll(async () => page.evaluate(() => (
      (window as typeof window & { __cloudiaMessages?: unknown[] }).__cloudiaMessages?.length ?? 0
    ))).toBe(0);
    expect(page.url()).toBe(evilParent);
  });
});

test.describe('failure and idempotency behavior', () => {
  test('shows the email fallback when the Worker start boundary fails', async ({ page }) => {
    await page.route('**/api/contact/chat/start', async (route) => {
      await fulfillJson(route, { internal: 'must not be rendered' }, 503);
    });

    await page.goto('/?intent=contract-dev&source=worker-failure&locale=en');

    await expect(page.getByText(/Chat is temporarily unavailable/)).toBeVisible();
    await expect(page.getByText('internal: must not be rendered')).toHaveCount(0);
    await expect(page.locator('input[name="griftHandoffConsent"]')).toHaveCount(0);
  });

  test('keeps the handoff form retryable when Worker submit fails', async ({ page }) => {
    await installReadyStart(page);
    await page.route('**/api/contact/submit', async (route) => {
      await fulfillJson(route, { secret: 'must not be rendered' }, 503);
    });

    await page.goto('/?intent=contract-dev&source=submit-failure&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/Chat is temporarily unavailable/)).toBeVisible();
    await expect(page.getByText('secret: must not be rendered')).toHaveCount(0);
    await expect(page.locator('textarea[name="summaryText"]')).toHaveValue(
      'Confirmed project scope, timing, and estimate goals.',
    );
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('treats an explicit Grift fallback as a successful email submission', async ({ page }) => {
    await installReadyStart(page);
    await page.route('**/api/contact/submit', async (route) => {
      await fulfillJson(route, {
        ok: true,
        receiptId: 'email-receipt',
        status: 'queued',
        handoff: { status: 'fallback' },
      });
    });

    await page.goto('/?intent=contract-dev&source=grift-failure&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/Grift is currently unavailable/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue in Grift' })).toHaveCount(0);
  });

  test('suppresses a synchronous duplicate click', async ({ page }) => {
    let submitCount = 0;
    await installReadyStart(page);
    await page.route('**/api/contact/submit', async (route) => {
      submitCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await fulfillJson(route, { ok: true, status: 'queued', handoff: { status: 'fallback' } });
    });

    await page.goto('/?intent=contract-dev&source=duplicate-click&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page);
    await page.locator('button[type="submit"]').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText(/Grift is currently unavailable/)).toBeVisible();
    expect(submitCount).toBe(1);
  });

  test('reuses idempotency identity and consent time after reload', async ({ page }) => {
    const startRequests: JsonObject[] = [];
    const submitRequests: JsonObject[] = [];
    await installReadyStart(page, startRequests, 'reload-session');
    await page.route('**/api/contact/submit', async (route) => {
      submitRequests.push(readJsonRequest(route));
      await fulfillJson(route, { ok: true, status: 'queued', handoff: { status: 'fallback' } });
    });

    const url = '/?intent=grift-paid-trial&source=reload-e2e&locale=ja';
    await page.goto(url);
    await openHandoffForm(page);
    await fillHandoffForm(page);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/現在Griftを利用できない/)).toBeVisible();

    await page.reload();
    await openHandoffForm(page);
    await fillHandoffForm(page);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/現在Griftを利用できない/)).toBeVisible();

    expect(startRequests).toHaveLength(2);
    expect(startRequests[1]).toMatchObject({
      intent: 'grift-paid-trial',
      source: 'reload-e2e',
      locale: 'ja',
      sessionId: 'reload-session',
    });
    expect(submitRequests).toHaveLength(2);
    expect(submitRequests[1].idempotencyKey).toBe(submitRequests[0].idempotencyKey);
    expect((submitRequests[1].handoffConsent as JsonObject).acceptedAt)
      .toBe((submitRequests[0].handoffConsent as JsonObject).acceptedAt);
  });
});

test.describe('consent UI boundaries', () => {
  test('editing the summary clears summary confirmation and Grift consent', async ({ page }) => {
    await installReadyStart(page);
    await page.goto('/?intent=contract-dev&source=summary-edit&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page);

    await expect(page.locator('input[name="summaryConfirmed"]')).toBeChecked();
    await expect(page.locator('input[name="griftHandoffConsent"]')).toBeChecked();
    await page.locator('textarea[name="summaryText"]').fill('Edited summary requiring fresh confirmation.');

    await expect(page.locator('input[name="summaryConfirmed"]')).not.toBeChecked();
    await expect(page.locator('input[name="griftHandoffConsent"]')).not.toBeChecked();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  for (const intent of ['confidential-ai-assessment', 'local-llm-poc', 'press-speaking-other'] as const) {
    test(`does not expose or trigger Grift for ${intent}`, async ({ page }) => {
      let portalRequests = 0;
      let submittedBody: JsonObject | undefined;
      await installReadyStart(page);
      await page.route('**/api/contact/submit', async (route) => {
        submittedBody = readJsonRequest(route);
        await fulfillJson(route, {
          ok: true,
          status: 'queued',
          handoff: { status: 'ready', url: PORTAL_URL, expiresAt: futureExpiry() },
        });
      });
      await page.route('https://app.griftai.org/**', async (route) => {
        portalRequests += 1;
        await route.abort();
      });

      await page.goto(`/?intent=${intent}&source=unrelated-intent&locale=en`);
      await openHandoffForm(page);
      await expect(page.locator('input[name="griftHandoffConsent"]')).toHaveCount(0);
      await fillHandoffForm(page, false);
      await page.locator('button[type="submit"]').click();
      await expect(page.getByText('Thank you. Your inquiry has been submitted.')).toBeVisible();

      expect(submittedBody).not.toHaveProperty('handoffConsent');
      expect(portalRequests).toBe(0);
    });
  }

  test('treats an unknown URL intent as unselected and does not call the Worker', async ({ page }) => {
    let startRequests = 0;
    await page.route('**/api/contact/chat/start', async (route) => {
      startRequests += 1;
      await fulfillJson(route, { reply: 'must not start', readyForContact: true });
    });

    await page.goto('/?intent=unknown-intent&source=unknown-source&locale=en');

    await expect(page.getByRole('button', { name: 'Request AI or software development' })).toBeVisible();
    await expect(page.locator('input[name="griftHandoffConsent"]')).toHaveCount(0);
    await expect(page.locator('textarea[name="summaryText"]')).toHaveCount(0);
    expect(startRequests).toBe(0);
  });
});

test.describe('accessibility and responsive behavior', () => {
  test('has no WCAG A/AA axe violations in the consent form', async ({ page }) => {
    await installReadyStart(page);
    await page.goto('/?intent=contract-dev&source=axe-e2e&locale=en');
    await openHandoffForm(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('supports the intent and consent flow with keyboard activation', async ({ page }) => {
    await installReadyStart(page);
    await page.goto('/?source=keyboard-e2e&locale=en');

    const intentButton = page.getByRole('button', { name: 'Request AI or software development' });
    await intentButton.focus();
    await page.keyboard.press('Enter');
    const openButton = page.getByRole('button', { name: 'Proceed to submit contact details' });
    await expect(openButton).toBeVisible();
    await openButton.focus();
    await page.keyboard.press('Enter');

    await page.locator('input[autocomplete="name"]').focus();
    await page.keyboard.type('Keyboard User');
    await page.locator('input[autocomplete="email"]').focus();
    await page.keyboard.type('keyboard@example.com');
    for (const selector of [
      'input[name="summaryConfirmed"]',
      'input[name="privacyConsent"]',
      'input[name="griftHandoffConsent"]',
    ]) {
      await page.locator(selector).focus();
      await page.keyboard.press('Space');
    }

    await expect(page.locator('input[name="summaryConfirmed"]')).toBeChecked();
    await expect(page.locator('input[name="privacyConsent"]')).toBeChecked();
    await expect(page.locator('input[name="griftHandoffConsent"]')).toBeChecked();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('fits mobile standalone and embed views without horizontal overflow and reserves safe area', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installReadyStart(page);
    await page.goto('/?embed=1&intent=contract-dev&source=mobile-e2e&locale=ja');

    const inputBar = page.locator('section > div.sticky');
    await expect(inputBar).toBeVisible();
    await expect(inputBar).toHaveClass(/safe-area-pad-bottom/);
    const initialDimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasSafeAreaRule: Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes('safe-area-inset-bottom'));
        } catch {
          return false;
        }
      }),
    }));
    expect(initialDimensions.scrollWidth).toBe(initialDimensions.clientWidth);
    expect(initialDimensions.hasSafeAreaRule).toBe(true);

    await openHandoffForm(page);
    await expect(page.locator('form')).toHaveClass(/safe-area-pad-bottom/);
    const formDimensions = await page.evaluate(() => {
      const form = document.querySelector('form');
      const rect = form?.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        left: rect?.left,
        right: rect?.right,
      };
    });
    expect(formDimensions.scrollWidth).toBe(formDimensions.clientWidth);
    expect(formDimensions.left).toBeGreaterThanOrEqual(0);
    expect(formDimensions.right).toBeLessThanOrEqual(390);
  });
});

test.describe('optional Turnstile boundary', () => {
  test('keeps the existing form compatible when no sitekey is configured', async ({ page }) => {
    test.skip(TURNSTILE_ENABLED, 'This case exercises the intentionally unconfigured path.');
    await installReadyStart(page);
    await page.goto('/?intent=contract-dev&source=no-turnstile-key&locale=en');
    await openHandoffForm(page);
    await fillHandoffForm(page);

    await expect(page.locator('.cloudia-turnstile')).toHaveCount(0);
    await expect(page.locator(`script[src^="${TURNSTILE_SCRIPT_URL.split('?')[0]}"]`)).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test.describe('when VITE_TURNSTILE_SITE_KEY is configured', () => {
    test.skip(!TURNSTILE_ENABLED, 'Run with VITE_TURNSTILE_SITE_KEY to exercise the configured path.');

    test('gates submit, sends only turnstileToken, and leaves no browser leak', async ({ page }) => {
      const submitRequests: JsonObject[] = [];
      const browserMessages: string[] = [];
      page.on('console', (message) => browserMessages.push(message.text()));
      await installReadyStart(page);
      await page.route('**/api/contact/submit', async (route) => {
        submitRequests.push(readJsonRequest(route));
        await fulfillJson(route, { ok: true, status: 'queued' });
      });

      await page.goto('/?intent=contract-dev&source=turnstile-e2e&locale=en&turnstileManual=1');
      await openHandoffForm(page);
      await fillHandoffForm(page, false);
      const submitButton = page.locator('button[type="submit"]');

      await expect(page.locator('[data-turnstile-status="ready"]')).toBeVisible();
      await expect(submitButton).toBeDisabled();
      await page.evaluate(() => {
        (window as typeof window & {
          __turnstileTest: { complete: (token: string) => void };
        }).__turnstileTest.complete('ephemeral-e2e-turnstile-token');
      });
      await expect(page.locator('[data-turnstile-status="verified"]')).toBeVisible();
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await expect(page.getByText('Thank you. Your inquiry has been submitted.')).toBeVisible();

      expect(submitRequests).toHaveLength(1);
      expect(submitRequests[0].turnstileToken).toBe('ephemeral-e2e-turnstile-token');
      expect(JSON.stringify(submitRequests[0].summaryText)).not.toContain('ephemeral-e2e-turnstile-token');
      expect(String(submitRequests[0].message)).not.toContain('ephemeral-e2e-turnstile-token');
      const leaks = await page.evaluate((token) => ({
        url: window.location.href.includes(token),
        markup: document.documentElement.innerHTML.includes(token),
        localStorage: Object.values(window.localStorage).some((value) => value.includes(token)),
        sessionStorage: Object.values(window.sessionStorage).some((value) => value.includes(token)),
      }), 'ephemeral-e2e-turnstile-token');
      expect(leaks).toEqual({ url: false, markup: false, localStorage: false, sessionStorage: false });
      expect(browserMessages.join('\n')).not.toContain('ephemeral-e2e-turnstile-token');
    });

    test('clears and resets on summary edits, lifecycle callbacks, and unmount', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await installReadyStart(page);
      await page.goto('/?intent=contract-dev&source=turnstile-reset&locale=en&turnstileManual=1');
      await openHandoffForm(page);
      await fillHandoffForm(page);
      const submitButton = page.locator('button[type="submit"]');
      const mobileState = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        sizes: (window as typeof window & {
          __turnstileTest: { sizes: string[] };
        }).__turnstileTest.sizes,
      }));
      expect(mobileState.scrollWidth).toBe(mobileState.clientWidth);
      expect(mobileState.sizes).toEqual(['compact']);
      const complete = async (token: string) => page.evaluate((value) => {
        (window as typeof window & {
          __turnstileTest: { complete: (nextToken: string) => void };
        }).__turnstileTest.complete(value);
      }, token);
      const invoke = async (event: 'expire' | 'fail' | 'timeout') => page.evaluate((name) => {
        const state = (window as typeof window & {
          __turnstileTest: {
            expire: () => void;
            fail: () => void;
            timeout: () => void;
          };
        }).__turnstileTest;
        state[name]();
      }, event);

      await complete('summary-edit-token');
      await expect(submitButton).toBeEnabled();
      await page.locator('textarea[name="summaryText"]').fill('Edited summary requiring a fresh security check.');
      await expect(page.locator('input[name="summaryConfirmed"]')).not.toBeChecked();
      await expect(submitButton).toBeDisabled();
      await expect.poll(() => page.evaluate(() => (
        (window as typeof window & { __turnstileTest: { resetCount: number } }).__turnstileTest.resetCount
      ))).toBe(1);

      await page.locator('input[name="summaryConfirmed"]').check();
      await page.locator('input[name="griftHandoffConsent"]').check();
      await complete('expiry-token');
      await expect(submitButton).toBeEnabled();
      await invoke('expire');
      await expect(page.locator('[data-turnstile-status="expired"]')).toBeVisible();
      await expect(submitButton).toBeDisabled();

      await complete('timeout-token');
      await invoke('timeout');
      await expect(page.locator('[data-turnstile-status="timeout"]')).toBeVisible();
      await expect(submitButton).toBeDisabled();

      await complete('error-token');
      await invoke('fail');
      await expect(page.locator('[data-turnstile-status="error"]')).toBeVisible();
      await expect(submitButton).toBeDisabled();

      await page.getByRole('button', { name: 'Back to chat' }).click();
      await expect(page.locator('.cloudia-turnstile')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => (
        (window as typeof window & { __turnstileTest: { removeCount: number } }).__turnstileTest.removeCount
      ))).toBe(1);
      await expect(page.locator(`script[src^="${TURNSTILE_SCRIPT_URL.split('?')[0]}"]`)).toHaveCount(1);

      await openHandoffForm(page);
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await expect.poll(() => page.evaluate(() => (
        (window as typeof window & { __turnstileTest: { renderCount: number } }).__turnstileTest.renderCount
      ))).toBe(2);
      await expect(page.locator(`script[src^="${TURNSTILE_SCRIPT_URL.split('?')[0]}"]`)).toHaveCount(1);
    });

    test('resets the consumed token after submit completion so a retry needs a fresh token', async ({ page }) => {
      await installReadyStart(page);
      await page.route('**/api/contact/submit', async (route) => {
        await fulfillJson(route, { internal: 'must not render' }, 503);
      });
      await page.goto('/?intent=contract-dev&source=turnstile-submit-reset&locale=en&turnstileManual=1');
      await openHandoffForm(page);
      await fillHandoffForm(page, false);
      await page.evaluate(() => {
        (window as typeof window & {
          __turnstileTest: { complete: (token: string) => void };
        }).__turnstileTest.complete('single-use-submit-token');
      });
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      await expect(page.getByText(/Chat is temporarily unavailable/)).toBeVisible();
      await expect(submitButton).toBeDisabled();
      await expect.poll(() => page.evaluate(() => (
        (window as typeof window & { __turnstileTest: { resetCount: number } }).__turnstileTest.resetCount
      ))).toBeGreaterThan(0);
    });

    test('fails closed when the exact Turnstile script is blocked by CSP or the network', async ({ page }) => {
      await page.unroute(TURNSTILE_SCRIPT_URL);
      await page.route(TURNSTILE_SCRIPT_URL, async (route) => route.abort('blockedbyclient'));
      await installReadyStart(page);
      await page.goto('/?intent=contract-dev&source=turnstile-csp&locale=en');
      await openHandoffForm(page);
      await fillHandoffForm(page);

      await expect(page.locator('[data-turnstile-status="error"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await expect(page.locator(`script[src^="${TURNSTILE_SCRIPT_URL.split('?')[0]}"]`)).toHaveCount(0);
    });
  });
});
