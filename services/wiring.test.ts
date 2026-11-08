/**
 * Wiring checks: the tracking module is only useful if the entry point starts it and the
 * submit button goes through it. These fail when either call is reverted.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('../services/analytics');
  vi.doUnmock('react-dom/client');
  vi.doUnmock('../App');
  vi.doUnmock('../contexts/LanguageContext');
});

describe('index.tsx', () => {
  it('starts analytics exactly once, at module level, before React renders', async () => {
    const startAnalytics = vi.fn();
    const render = vi.fn();
    vi.resetModules();
    vi.doMock('../services/analytics', () => ({ startAnalytics }));
    vi.doMock('react-dom/client', () => ({ default: { createRoot: () => ({ render }) } }));
    vi.doMock('../App', () => ({ default: () => null }));
    vi.doMock('../contexts/LanguageContext', () => ({ LanguageProvider: ({ children }: { children: unknown }) => children }));
    vi.stubGlobal('document', { getElementById: () => ({}) });

    await import('../index');

    expect(startAnalytics).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(startAnalytics.mock.invocationCallOrder[0]).toBeLessThan(render.mock.invocationCallOrder[0]);
  });
});

describe('App.tsx', () => {
  // A source-level link: rendering App needs a DOM, which this project's tests do not use.
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  it('submits through submitContactInquiry (which counts the completion)', () => {
    expect(source).toMatch(/from '\.\/services\/submitWithAnalytics'/);
    expect(source).toMatch(/await submitContactInquiry\(/);
  });

  it('never calls postContactSubmit directly, which would skip the counting', () => {
    expect(source).not.toMatch(/postContactSubmit/);
  });
});
