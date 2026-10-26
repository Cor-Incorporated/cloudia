/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_CONTACT_API_BASE?: string;
  readonly VITE_CONTACT_CHAT_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
