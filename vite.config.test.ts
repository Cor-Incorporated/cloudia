import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cloudiaHeadersAssetForBuild,
  previewReleaseAssetForBuild,
  resolveCloudiaEmbedParentOriginsForBuild,
  resolveContactApiBaseForBuild,
  resolveGriftPublicUrlOriginsForBuild,
  resolvePreviewReleaseMetadata,
} from './vite.config';

const validPreviewReleaseEnv = Object.freeze({
  VITE_CLOUDIA_CANDIDATE_SHA: 'a'.repeat(40),
  VITE_CLOUDIA_DEPLOYMENT_ID: 'cloudia-preview-20260714-001',
  VITE_CLOUDIA_RELEASE_ID: 'cloudia-grift-uat-20260714-001',
});

describe('Cloudia embed parent origin build boundary', () => {
  const firebasePreviewOrigin = 'https://cor-jp-main--preview-abc123.web.app';

  it('drops Firebase Preview parents from production even when CI carries the variable', () => {
    expect(resolveCloudiaEmbedParentOriginsForBuild('production', firebasePreviewOrigin)).toBe('');
  });

  it('preserves configured parents only for a non-production build mode', () => {
    expect(resolveCloudiaEmbedParentOriginsForBuild('preview', firebasePreviewOrigin))
      .toBe(firebasePreviewOrigin);
  });

  it('emits the exact production policy and ignores even invalid injected Preview config', () => {
    expect(cloudiaHeadersAssetForBuild(
      'production',
      `${firebasePreviewOrigin},https://preview.example.web.app/path`,
    )).toEqual({
      fileName: '_headers',
      source: [
        '/*',
        "  Content-Security-Policy: frame-ancestors 'self' https://cor-jp.com https://www.cor-jp.com",
        '',
        '/release.json',
        '  Cache-Control: no-store',
        '  X-Content-Type-Options: nosniff',
        '  ! Access-Control-Allow-Origin',
        '',
      ].join('\n'),
    });
  });

  it('emits the exact Preview policy with canonical configured parents', () => {
    expect(cloudiaHeadersAssetForBuild('preview', firebasePreviewOrigin).source).toBe([
      '/*',
      `  Content-Security-Policy: frame-ancestors 'self' https://cor-jp.com https://www.cor-jp.com ${firebasePreviewOrigin}`,
      '',
      '/release.json',
      '  Cache-Control: no-store',
      '  X-Content-Type-Options: nosniff',
      '  ! Access-Control-Allow-Origin',
      '',
    ].join('\n'));
  });

  it('deduplicates configured origins deterministically', () => {
    expect(resolveCloudiaEmbedParentOriginsForBuild(
      'preview',
      `${firebasePreviewOrigin}, ${firebasePreviewOrigin}`,
    )).toBe(firebasePreviewOrigin);
  });

  it.each([
    undefined,
    '',
    `${firebasePreviewOrigin},`,
    `,${firebasePreviewOrigin}`,
    `${firebasePreviewOrigin},https://*.web.app`,
    `${firebasePreviewOrigin},https://user:password@example.web.app`,
    `${firebasePreviewOrigin},https://example.web.app/`,
    `${firebasePreviewOrigin},https://example.web.app/path`,
    `${firebasePreviewOrigin},https://example.web.app?preview=1`,
    `${firebasePreviewOrigin},https://example.web.app#preview`,
    `${firebasePreviewOrigin},https://example.web.app:443`,
    `${firebasePreviewOrigin},http://example.web.app`,
    `${firebasePreviewOrigin},HTTPS://example.web.app`,
    `${firebasePreviewOrigin},https://EXAMPLE.web.app`,
    `${firebasePreviewOrigin},https://example%2Eweb.app`,
    `${firebasePreviewOrigin},https://example.web.app.`,
  ])('fails the whole Preview build boundary for missing or polluted config: %s', (configured) => {
    expect(() => cloudiaHeadersAssetForBuild('preview', configured)).toThrow(
      'Invalid or missing public Preview build variable: VITE_CLOUDIA_EMBED_PARENT_ORIGINS',
    );
  });

  it('does not echo a rejected parent origin into build logs', () => {
    const rejected = 'https://preview.example.web.app/path-with-sensitive-marker';
    expect(() => cloudiaHeadersAssetForBuild('preview', rejected)).toThrowError(
      expect.not.stringContaining(rejected),
    );
  });
});

describe('Grift public origin build boundary', () => {
  it('drops Preview origins from production even when the build environment carries them', () => {
    expect(resolveGriftPublicUrlOriginsForBuild(
      'production',
      'https://grift-preview.example.run.app',
    )).toBe('');
  });

  it('preserves explicitly configured origins only for a non-production build mode', () => {
    expect(resolveGriftPublicUrlOriginsForBuild(
      'preview',
      'https://grift-preview.example.run.app',
    )).toBe('https://grift-preview.example.run.app');
  });
});

describe('Contact API build boundary', () => {
  it('forces same-origin contact APIs in production when Preview config leaks into CI', () => {
    expect(resolveContactApiBaseForBuild(
      'production',
      'https://contact-preview.example.workers.dev',
    )).toBe('');
  });

  it('preserves an explicitly configured API base only for non-production builds', () => {
    expect(resolveContactApiBaseForBuild(
      'preview',
      'https://contact-preview.example.workers.dev',
    )).toBe('https://contact-preview.example.workers.dev');
  });
});

describe('Cloudia Preview release provenance', () => {
  it('keeps the public fallback header production-safe with the release protections', () => {
    const headersFile = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');
    const releaseRule = headersFile
      .split(/\r?\n(?=\/)/)
      .find((block) => block.split(/\r?\n/, 1)[0]?.trim() === '/release.json');

    expect(releaseRule).toBeDefined();
    expect(releaseRule?.split(/\r?\n/).filter(Boolean).map((line) => line.trim())).toEqual([
      '/release.json',
      'Cache-Control: no-store',
      'X-Content-Type-Options: nosniff',
      '! Access-Control-Allow-Origin',
    ]);
    expect(releaseRule).not.toMatch(/^\s*Access-Control-Allow-Origin\s*:/im);
    expect(headersFile).toContain(
      "Content-Security-Policy: frame-ancestors 'self' https://cor-jp.com https://www.cor-jp.com",
    );
    expect(headersFile).not.toContain('web.app');
  });

  it('emits the exact public release schema as a static root asset', () => {
    const asset = previewReleaseAssetForBuild('preview', validPreviewReleaseEnv);

    expect(asset).toEqual({
      fileName: 'release.json',
      source: `${JSON.stringify({
        status: 'ok',
        service: 'cloudia',
        repository: 'Cor-Incorporated/cloudia',
        candidate_sha: 'a'.repeat(40),
        deployment_id: 'cloudia-preview-20260714-001',
        release_id: 'cloudia-grift-uat-20260714-001',
      })}\n`,
    });
    expect(Object.keys(JSON.parse(asset?.source ?? '{}'))).toEqual([
      'status',
      'service',
      'repository',
      'candidate_sha',
      'deployment_id',
      'release_id',
    ]);
  });

  it.each([
    ['VITE_CLOUDIA_CANDIDATE_SHA', undefined],
    ['VITE_CLOUDIA_CANDIDATE_SHA', 'A'.repeat(40)],
    ['VITE_CLOUDIA_CANDIDATE_SHA', 'a'.repeat(39)],
    ['VITE_CLOUDIA_DEPLOYMENT_ID', undefined],
    ['VITE_CLOUDIA_DEPLOYMENT_ID', 'bad deployment id'],
    ['VITE_CLOUDIA_DEPLOYMENT_ID', 'x'.repeat(257)],
    ['VITE_CLOUDIA_RELEASE_ID', undefined],
    ['VITE_CLOUDIA_RELEASE_ID', 'release/id'],
    ['VITE_CLOUDIA_RELEASE_ID', 'x'.repeat(101)],
  ] as const)('fails closed when %s is missing or invalid', (name, value) => {
    expect(() => resolvePreviewReleaseMetadata('preview', {
      ...validPreviewReleaseEnv,
      [name]: value,
    })).toThrow(`Invalid or missing public Preview build variable: ${name}`);
  });

  it('does not echo a rejected value into retained build logs', () => {
    const rejected = 'unsafe secret-shaped value';

    try {
      resolvePreviewReleaseMetadata('preview', {
        ...validPreviewReleaseEnv,
        VITE_CLOUDIA_RELEASE_ID: rejected,
      });
      throw new Error('Expected invalid release ID to fail');
    } catch (error) {
      expect(String(error)).toContain('VITE_CLOUDIA_RELEASE_ID');
      expect(String(error)).not.toContain(rejected);
    }
  });

  it.each(['production', 'development', 'test'])('does not emit Preview metadata in %s mode', (mode) => {
    expect(previewReleaseAssetForBuild(mode, validPreviewReleaseEnv)).toBeUndefined();
  });

  it('ignores even malformed Preview metadata variables in production mode', () => {
    expect(resolvePreviewReleaseMetadata('production', {
      VITE_CLOUDIA_CANDIDATE_SHA: 'not-a-sha',
      VITE_CLOUDIA_DEPLOYMENT_ID: 'not safe',
      VITE_CLOUDIA_RELEASE_ID: 'not safe',
    })).toBeUndefined();
  });
});
