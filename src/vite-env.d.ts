/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_AD_REWARDED_ID?: string;
  readonly VITE_AD_INTERSTITIAL_ID?: string;
  readonly VITE_FEATURE_PAYMENTS?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
