import { Storage } from '@apps-in-toss/web-framework';

/**
 * 토큰 보관
 * - access: 메모리만 (1시간)
 * - refresh: SDK Storage (네이티브 저장소, 앱 종료 후에도 유지). iOS는 서드파티 쿠키가 막혀 쿠키 사용 불가
 */
const REFRESH_KEY = 'darakbang.refresh';
let accessToken: string | null = null;

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => {
    accessToken = t;
  },
  getRefresh: () => Storage.getItem(REFRESH_KEY).catch(() => null),
  setRefresh: (t: string) => Storage.setItem(REFRESH_KEY, t).catch(() => {}),
  clear: async () => {
    accessToken = null;
    await Storage.removeItem(REFRESH_KEY).catch(() => {});
  },
};
