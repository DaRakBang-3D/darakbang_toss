import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from '@/features/auth/auth';
import { features } from '@/lib/env';
import { EditorPage } from '@/pages/EditorPage';
import { HomePage } from '@/pages/HomePage';
import { VisitPage } from '@/pages/VisitPage';
import { useRouter } from './router';

// 상점은 별도 청크. 결제 기능이 꺼져 있으면 내려받지도 않음
const ShopPage = lazy(() => import('@/pages/ShopPage').then((m) => ({ default: m.ShopPage })));

const PAGES = {
  home: HomePage,
  editor: EditorPage,
  visit: VisitPage,
  shop: features.payments ? ShopPage : HomePage,
} as const;

export function App() {
  const page = useRouter((s) => s.page);
  const Page = PAGES[page];

  const tossLinked = useAuth((s) => s.user?.tossLinked ?? false);

  useEffect(() => {
    void useAuth.getState().bootstrap();
  }, []);

  useEffect(() => {
    // 결제는 됐는데 지급 못 한 주문 복원 (검수 필수 시나리오). 결제는 토스 로그인 이후에만 가능
    if (!features.payments || !tossLinked) return;
    import('@/features/iap/iap')
      .then((m) => m.restorePendingOrders())
      .catch((e) => console.warn('[iap] 복원 실패', e));
  }, [tossLinked]);

  return (
    <TDSMobileAITProvider>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </TDSMobileAITProvider>
  );
}
