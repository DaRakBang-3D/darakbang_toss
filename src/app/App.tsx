import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { useEffect } from 'react';
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

  useEffect(() => {
    // 결제는 됐는데 지급 못 한 주문 복원 (검수 필수 시나리오)
    restorePendingOrders().catch((e) => console.warn('[iap] 복원 실패', e));
  }, []);

  return (
    <TDSMobileAITProvider>
      <Page />
    </TDSMobileAITProvider>
  );
}
