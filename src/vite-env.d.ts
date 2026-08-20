/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_MAP_PROXY_MODE?: 'vite' | 'php'
  readonly VITE_TILE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __GIT_COMMIT__: string
declare const __BUILD_DATE__: string
