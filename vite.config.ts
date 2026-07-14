import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export function resolveGriftPublicUrlOriginsForBuild(
  mode: string,
  configuredOrigins: string | undefined,
): string {
  return mode === 'production' ? '' : configuredOrigins || '';
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', ['VITE_', '']);
    // Cloudflare's contact edge serves the Pages app under /contact/chat and
    // strips that prefix before forwarding requests to the Pages origin.
    // Keep local dev rooted at / while making a plain production build deployable
    // behind that edge route. VITE_BASE_PATH remains an explicit override.
    const configuredBase = env.VITE_BASE_PATH || (mode === 'production' ? '/contact/chat/' : '/');
    const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
    const robots = env.VITE_ROBOTS || 'index,follow';
    // A Preview/Staging origin must never be admitted by a production bundle,
    // even if the CI environment accidentally carries the public build variable.
    const griftPublicUrlOrigins = resolveGriftPublicUrlOriginsForBuild(
      mode,
      env.VITE_GRIFT_PUBLIC_URL_ORIGINS,
    );
    return {
      base,
      define: {
        'process.env.GOOGLE_CALENDAR_ICAL_URL': JSON.stringify(env.VITE_GOOGLE_CALENDAR_ICAL_URL || env.GOOGLE_CALENDAR_ICAL_URL),
        'import.meta.env.VITE_ROBOTS': JSON.stringify(robots),
        'import.meta.env.VITE_GRIFT_PUBLIC_URL_ORIGINS': JSON.stringify(griftPublicUrlOrigins),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
