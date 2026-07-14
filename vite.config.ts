import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export function resolveGriftPublicUrlOriginsForBuild(
  mode: string,
  configuredOrigins: string | undefined,
): string {
  return mode === 'production' ? '' : configuredOrigins || '';
}

export function resolveContactApiBaseForBuild(
  mode: string,
  configuredBase: string | undefined,
): string {
  // Production is mounted behind corsweb and must call same-origin contact
  // routes. A broadly scoped Pages variable must not leak a Preview Worker URL
  // into the production bundle.
  return mode === 'production' ? '' : configuredBase || '';
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
    const contactApiBase = resolveContactApiBaseForBuild(
      mode,
      env.VITE_CONTACT_API_BASE,
    );
    return {
      base,
      define: {
        'process.env.GOOGLE_CALENDAR_ICAL_URL': JSON.stringify(env.VITE_GOOGLE_CALENDAR_ICAL_URL || env.GOOGLE_CALENDAR_ICAL_URL),
        'import.meta.env.VITE_ROBOTS': JSON.stringify(robots),
        'import.meta.env.VITE_CONTACT_API_BASE': JSON.stringify(contactApiBase),
        'import.meta.env.VITE_GRIFT_PUBLIC_URL_ORIGINS': JSON.stringify(griftPublicUrlOrigins),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
