/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTACT_API_BASE?: string;
  readonly VITE_CONTACT_CHAT_MOCK?: string;
  readonly VITE_FALLBACK_CONTACT_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
