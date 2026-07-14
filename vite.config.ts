import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { parseCanonicalExactHttpsOrigin } from './utils/exactHttpsOrigin';

const CLOUDIA_REPOSITORY = 'Cor-Incorporated/cloudia';
const FULL_LOWER_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SAFE_DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{4,255}$/;
const SAFE_RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const PRODUCTION_EMBED_PARENT_ORIGINS = [
  'https://cor-jp.com',
  'https://www.cor-jp.com',
] as const;

export interface PreviewReleaseMetadata {
  status: 'ok';
  service: 'cloudia';
  repository: typeof CLOUDIA_REPOSITORY;
  candidate_sha: string;
  deployment_id: string;
  release_id: string;
}

interface PreviewReleaseBuildEnv {
  VITE_CLOUDIA_CANDIDATE_SHA?: string;
  VITE_CLOUDIA_DEPLOYMENT_ID?: string;
  VITE_CLOUDIA_RELEASE_ID?: string;
}

export interface PreviewReleaseAsset {
  fileName: 'release.json';
  source: string;
}

export interface CloudiaHeadersAsset {
  fileName: '_headers';
  source: string;
}

function requirePreviewReleaseValue(
  name: keyof PreviewReleaseBuildEnv,
  value: string | undefined,
  pattern: RegExp,
): string {
  if (!value || !pattern.test(value)) {
    // Do not include the rejected value in the error: build logs are retained.
    throw new Error(`Invalid or missing public Preview build variable: ${name}`);
  }
  return value;
}

export function resolvePreviewReleaseMetadata(
  mode: string,
  env: PreviewReleaseBuildEnv,
): PreviewReleaseMetadata | undefined {
  if (mode !== 'preview') return undefined;

  return {
    status: 'ok',
    service: 'cloudia',
    repository: CLOUDIA_REPOSITORY,
    candidate_sha: requirePreviewReleaseValue(
      'VITE_CLOUDIA_CANDIDATE_SHA',
      env.VITE_CLOUDIA_CANDIDATE_SHA,
      FULL_LOWER_SHA_PATTERN,
    ),
    deployment_id: requirePreviewReleaseValue(
      'VITE_CLOUDIA_DEPLOYMENT_ID',
      env.VITE_CLOUDIA_DEPLOYMENT_ID,
      SAFE_DEPLOYMENT_ID_PATTERN,
    ),
    release_id: requirePreviewReleaseValue(
      'VITE_CLOUDIA_RELEASE_ID',
      env.VITE_CLOUDIA_RELEASE_ID,
      SAFE_RELEASE_ID_PATTERN,
    ),
  };
}

export function previewReleaseAssetForBuild(
  mode: string,
  env: PreviewReleaseBuildEnv,
): PreviewReleaseAsset | undefined {
  const metadata = resolvePreviewReleaseMetadata(mode, env);
  if (!metadata) return undefined;

  return {
    fileName: 'release.json',
    source: `${JSON.stringify(metadata)}\n`,
  };
}

function cloudiaBuildAssetsPlugin(
  releaseAsset: PreviewReleaseAsset | undefined,
  headersAsset: CloudiaHeadersAsset,
): Plugin {
  return {
    name: 'cloudia-environment-build-assets',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: headersAsset.fileName,
        source: headersAsset.source,
      });
      if (!releaseAsset) return;
      this.emitFile({
        type: 'asset',
        fileName: releaseAsset.fileName,
        source: releaseAsset.source,
      });
    },
  };
}

export function resolveGriftPublicUrlOriginsForBuild(
  mode: string,
  configuredOrigins: string | undefined,
): string {
  return mode === 'production' ? '' : configuredOrigins || '';
}

export function resolveCloudiaEmbedParentOriginsForBuild(
  mode: string,
  configuredOrigins: string | undefined,
): string {
  // The additional parent allowlist exists only for isolated Preview/Staging
  // artifacts. Production always relies on the two built-in cor-jp.com origins.
  if (mode === 'production') return '';
  if (!configuredOrigins) {
    if (mode === 'preview') {
      throw new Error('Invalid or missing public Preview build variable: VITE_CLOUDIA_EMBED_PARENT_ORIGINS');
    }
    return '';
  }

  const origins = new Set<string>();
  for (const rawOrigin of configuredOrigins.split(',')) {
    const origin = parseCanonicalExactHttpsOrigin(rawOrigin.trim());
    if (!origin) {
      // Do not echo rejected public configuration into retained build logs.
      throw new Error('Invalid or missing public Preview build variable: VITE_CLOUDIA_EMBED_PARENT_ORIGINS');
    }
    origins.add(origin);
  }
  return [...origins].join(',');
}

export function cloudiaHeadersAssetForBuild(
  mode: string,
  configuredOrigins: string | undefined,
): CloudiaHeadersAsset {
  const previewOrigins = resolveCloudiaEmbedParentOriginsForBuild(mode, configuredOrigins)
    .split(',')
    .filter(Boolean);
  const frameAncestors = ["'self'", ...PRODUCTION_EMBED_PARENT_ORIGINS, ...previewOrigins];

  return {
    fileName: '_headers',
    source: [
      '/*',
      `  Content-Security-Policy: frame-ancestors ${frameAncestors.join(' ')}`,
      '',
      '/release.json',
      '  Cache-Control: no-store',
      '  X-Content-Type-Options: nosniff',
      '  ! Access-Control-Allow-Origin',
      '',
    ].join('\n'),
  };
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
    const previewReleaseAsset = previewReleaseAssetForBuild(mode, env);
    const headersAsset = cloudiaHeadersAssetForBuild(
      mode,
      env.VITE_CLOUDIA_EMBED_PARENT_ORIGINS,
    );
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
    const embedParentOrigins = resolveCloudiaEmbedParentOriginsForBuild(
      mode,
      env.VITE_CLOUDIA_EMBED_PARENT_ORIGINS,
    );
    const contactApiBase = resolveContactApiBaseForBuild(
      mode,
      env.VITE_CONTACT_API_BASE,
    );
    return {
      base,
      plugins: [cloudiaBuildAssetsPlugin(previewReleaseAsset, headersAsset)],
      define: {
        'process.env.GOOGLE_CALENDAR_ICAL_URL': JSON.stringify(env.VITE_GOOGLE_CALENDAR_ICAL_URL || env.GOOGLE_CALENDAR_ICAL_URL),
        'import.meta.env.VITE_ROBOTS': JSON.stringify(robots),
        'import.meta.env.VITE_CONTACT_API_BASE': JSON.stringify(contactApiBase),
        'import.meta.env.VITE_GRIFT_PUBLIC_URL_ORIGINS': JSON.stringify(griftPublicUrlOrigins),
        'import.meta.env.VITE_CLOUDIA_EMBED_PARENT_ORIGINS': JSON.stringify(embedParentOrigins),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
