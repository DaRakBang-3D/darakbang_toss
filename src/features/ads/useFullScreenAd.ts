import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  adGroupId: string;
  /** 보상형 광고에서 끝까지 시청했을 때만 호출됨 (userEarnedReward) */
  onReward?: (reward: { unitType: string; unitAmount: number }) => void;
  onClosed?: () => void;
}

/**
 * 전면형/보상형 광고 공용 훅. 광고 타입은 adGroupId로 결정된다.
 * 규칙: load → loaded 이벤트 → show → dismissed → 다음 load
 */
export function useFullScreenAd({ adGroupId, onReward, onClosed }: Options) {
  const supported = loadFullScreenAd.isSupported();
  const [ready, setReady] = useState(false);
  const unregisterRef = useRef<(() => void) | null>(null);
  const handlers = useRef({ onReward, onClosed });
  useEffect(() => {
    handlers.current = { onReward, onClosed };
  });

  // ready=false 처리는 show()에서 한다 (effect 안에서 동기 setState 금지)
  const load = useCallback(() => {
    if (!supported) return;
    unregisterRef.current?.();
    unregisterRef.current = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (e) => e.type === 'loaded' && setReady(true),
      onError: (err) => console.warn('[ads] 로드 실패', adGroupId, err),
    });
  }, [adGroupId, supported]);

  useEffect(() => {
    load();
    return () => unregisterRef.current?.();
  }, [load]);

  const show = useCallback(() => {
    if (!ready) return false;
    setReady(false);
    showFullScreenAd({
      options: { adGroupId },
      onEvent: (e) => {
        if (e.type === 'userEarnedReward') handlers.current.onReward?.(e.data);
        if (e.type === 'dismissed' || e.type === 'failedToShow') {
          handlers.current.onClosed?.();
          load();
        }
      },
      onError: (err) => {
        console.warn('[ads] 표시 실패', adGroupId, err);
        load();
      },
    });
    return true;
  }, [adGroupId, load, ready]);

  return { supported, ready, show };
}
