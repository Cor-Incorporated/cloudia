import type { Plugin } from 'vite';
import { isLocalIntakeEnabled, type LocalIntakeEnv } from './gateway';
import { createLocalIntakeMiddleware } from './middleware';

/** Dev-server only. Production Pages builds do not mount this plugin's middleware. */
export function localIntakeDevPlugin(env: LocalIntakeEnv): Plugin {
  return {
    name: 'cloudia-local-intake',
    configureServer(server) {
      if (!isLocalIntakeEnabled(env)) return;
      if ((env.VITE_CONTACT_API_BASE || '').trim()) {
        server.config.logger.warn(
          '[cloudia] CLOUDIA_INTAKE_PROVIDER=local does not intercept browser calls while VITE_CONTACT_API_BASE is set. Leave VITE_CONTACT_API_BASE empty to use the local intake middleware.',
        );
      }
      server.middlewares.use(createLocalIntakeMiddleware(env));
    },
  };
}
