import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', ['VITE_', '']);
    const configuredBase = env.VITE_BASE_PATH || '/';
    const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
    const robots = env.VITE_ROBOTS || 'index,follow';
    return {
      base,
      define: {
        'process.env.GOOGLE_CALENDAR_ICAL_URL': JSON.stringify(env.VITE_GOOGLE_CALENDAR_ICAL_URL || env.GOOGLE_CALENDAR_ICAL_URL),
        'import.meta.env.VITE_ROBOTS': JSON.stringify(robots),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
