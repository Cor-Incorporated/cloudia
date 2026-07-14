import { describe, expect, it } from 'vitest';
import {
  resolveContactApiBaseForBuild,
  resolveGriftPublicUrlOriginsForBuild,
} from './vite.config';

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
