import { useCallback, useRef } from 'react';
import { env } from '@/lib/env';
import { useFullScreenAd } from './useFullScreenAd';

/** 전면 광고 최소 간격. TODO: 운영 데이터 보고 조정 */
const MIN_INTERVAL_MS = 3 * 60 * 1000;

export type InterstitialMoment = 'after-save' | 'after-share';

/**
 * 전면 광고는 저장·공유 '직후'에만 노출한다 (편집 중 노출 금지 = UX 원칙).
 * 그래서 호출 시점을 타입으로 제한한다.
 */
export function useInterstitialAfter() {
  const { show } = useFullScreenAd({ adGroupId: env.adInterstitialId });
  const lastShownAt = useRef(0);

  return useCallback(
    (_moment: InterstitialMoment) => {
      if (Date.now() - lastShownAt.current < MIN_INTERVAL_MS) return;
      if (show()) lastShownAt.current = Date.now();
    },
    [show],
  );
}
