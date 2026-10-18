import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔에 등록한 appName과 같아야 함 (intoss://darakbang)
  appName: 'darakbang',
  brand: {
    // TODO: scene-tokens의 램프빛 노랑 확정값으로 교체
    primaryColor: '#F5B83D',
  },
  permissions: [],
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
  webView: {
    // 3D 캔버스 드래그와 충돌하지 않게 바운스/당겨서 새로고침 끔
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },
  webBundleDir: 'dist',
});
