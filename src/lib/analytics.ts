import { Analytics } from '@apps-in-toss/web-framework';

/** 기획 문서 '지표와 로깅'의 이벤트 목록. 여기 없는 이름은 쓰지 않는다. */
export type AppEvent =
  | 'item_generate'
  | 'item_place'
  | 'room_save'
  | 'room_share'
  | 'room_visit'
  | 'ad_reward_earned'
  | 'ad_interstitial_shown'
  | 'iap_purchase'
  | 'quota_exhausted';

export function track(name: AppEvent, params: Record<string, string | number | boolean> = {}) {
  void Analytics.log({ log_name: name, log_type: 'event', params }).catch(() => {});
}
