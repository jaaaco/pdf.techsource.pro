/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GTM_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_BUY_ME_COFFEE_URL?: string
  readonly VITE_GITHUB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
