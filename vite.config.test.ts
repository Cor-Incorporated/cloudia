import { describe, expect, it } from 'vitest';
import { resolveGriftPublicUrlOriginsForBuild } from './vite.config';

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
