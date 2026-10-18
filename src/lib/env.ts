/** 빌드 시점 환경변수. 값이 없으면 개발용 기본값(테스트 광고 ID 등)을 쓴다. */
export const env = {
  apiBase: import.meta.env.VITE_API_BASE ?? '/api',
  adRewardedId: import.meta.env.VITE_AD_REWARDED_ID ?? 'ait-ad-test-rewarded-id',
  adInterstitialId: import.meta.env.VITE_AD_INTERSTITIAL_ID ?? 'ait-ad-test-interstitial-id',
} as const;
