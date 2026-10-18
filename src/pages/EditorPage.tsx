import { Button, useToast } from '@toss/tds-mobile';
import { lazy, Suspense } from 'react';
import { env } from '@/lib/env';
import { track } from '@/lib/analytics';
import { useFullScreenAd } from '@/features/ads/useFullScreenAd';
import { useInterstitialAfter } from '@/features/ads/useInterstitialAfter';
import { useQuota } from '@/features/ai-generate/quota';

// three(약 600KB)는 에디터 진입 시점에만 받는다
const RoomCanvas = lazy(() => import('@/scene/RoomCanvas'));

export function EditorPage() {
  const { openToast } = useToast();
  const { remaining, grantFromAd } = useQuota();
  const showInterstitial = useInterstitialAfter();
  const rewarded = useFullScreenAd({
    adGroupId: env.adRewardedId,
    onReward: () => {
      track('ad_reward_earned');
      grantFromAd()
        .then(() => openToast('생성권 1개 받았어'))
        .catch(() => openToast('지급이 늦어지고 있어. 잠시 후 다시 확인해줘'));
    },
  });

  const handleSave = () => {
    // TODO: 방 저장 API
    track('room_save');
    openToast('저장했어');
    showInterstitial('after-save');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Suspense fallback={null}>
          <RoomCanvas />
        </Suspense>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <Button display="full" variant="weak" disabled={!rewarded.ready} onClick={rewarded.show}>
          광고 보고 생성권 받기 ({remaining})
        </Button>
        <Button display="full" onClick={handleSave}>
          저장
        </Button>
      </div>
    </div>
  );
}
