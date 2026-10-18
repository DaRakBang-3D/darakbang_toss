import { Button, List, ListRow, Top, useToast } from '@toss/tds-mobile';
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { getProducts, purchase, type IapProductListItem } from '@/features/iap/iap';
import { useQuota } from '@/features/ai-generate/quota';

export function ShopPage() {
  const { openToast } = useToast();
  const refreshQuota = useQuota((s) => s.refresh);
  const [products, setProducts] = useState<IapProductListItem[]>([]);

  useEffect(() => {
    getProducts().then(setProducts).catch(console.error);
  }, []);

  const buy = async (sku: string) => {
    const { ok } = await purchase(sku);
    if (!ok) return;
    track('iap_purchase', { sku });
    openToast('생성권이 들어왔어');
    void refreshQuota().catch(() => {});
  };

  return (
    <>
      <Top title={<Top.TitleParagraph size={22}>생성권 상점</Top.TitleParagraph>} />
      <List>
        {products.map((p) => (
          <ListRow
            key={p.sku}
            contents={<ListRow.Texts type="2RowTypeA" top={p.displayName} bottom={p.displayAmount} />}
            right={
              <Button size="medium" onClick={() => buy(p.sku)}>
                구매
              </Button>
            }
          />
        ))}
      </List>
      {products.length === 0 && <p style={{ padding: 24 }}>지금은 살 수 있는 상품이 없어</p>}
    </>
  );
}
