/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_CONTACT_API_BASE?: string;
  readonly VITE_CONTACT_CHAT_MOCK?: string;
  readonly VITE_FALLBACK_CONTACT_URL?: string;
  /** Exact comma-separated HTTPS parent origins for Preview/Staging embeds only. */
  readonly VITE_CLOUDIA_EMBED_PARENT_ORIGINS?: string;
  /** Required exact comma-separated HTTPS Grift origins for Preview/Staging builds only. */
  readonly VITE_GRIFT_PUBLIC_URL_ORIGINS?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
