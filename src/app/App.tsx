import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/auth';
import { restorePendingOrders } from '@/features/iap/iap';
import { EditorPage } from '@/pages/EditorPage';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { VisitPage } from '@/pages/VisitPage';
import { useRouter } from './router';

const PAGES = { home: HomePage, editor: EditorPage, visit: VisitPage, shop: ShopPage } as const;

export function App() {
  const page = useRouter((s) => s.page);
  const Page = PAGES[page];

  const tossLinked = useAuth((s) => s.user?.tossLinked ?? false);

  useEffect(() => {
    void useAuth.getState().bootstrap();
  }, []);

  useEffect(() => {
    // 결제는 됐는데 지급 못 한 주문 복원 (검수 필수 시나리오). 결제는 토스 로그인 이후에만 가능
    if (tossLinked) restorePendingOrders().catch((e) => console.warn('[iap] 복원 실패', e));
  }, [tossLinked]);

  return (
    <TDSMobileAITProvider>
      <Page />
    </TDSMobileAITProvider>
  );
}
