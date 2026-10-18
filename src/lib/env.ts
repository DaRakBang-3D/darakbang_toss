/** 빌드 시점 환경변수. 값이 없으면 개발용 기본값(테스트 광고 ID 등)을 쓴다. */
export const env = {
  apiBase: import.meta.env.VITE_API_BASE ?? '/api',
  adRewardedId: import.meta.env.VITE_AD_REWARDED_ID ?? 'ait-ad-test-rewarded-id',
  adInterstitialId: import.meta.env.VITE_AD_INTERSTITIAL_ID ?? 'ait-ad-test-interstitial-id',
} as const;

/**
 * 기능 스위치.
 * payments: 인앱결제 + 토스 로그인(1단계 인증). 둘 다 사업자 등록이 필요해서 출시 1차엔 끔.
 * 사업자 등록 후 VITE_FEATURE_PAYMENTS=true 로 다시 빌드·배포하면 켜진다.
 */
export const features = {
  payments: import.meta.env.VITE_FEATURE_PAYMENTS === 'true',
} as const;
