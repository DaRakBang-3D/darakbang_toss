import { IAP, type IapProductListItem } from '@apps-in-toss/web-framework';
import { api } from '@/api/client';

export type { IapProductListItem };

export async function getProducts(): Promise<IapProductListItem[]> {
  if (!IAP.getProductItemList.isSupported()) return [];
  const res = await IAP.getProductItemList();
  return res?.products ?? [];
}

/** 서버에 상품 지급 요청. 서버는 주문 상태 조회 API로 검증 후 생성권을 지급한다. */
async function grantOnServer(orderId: string, sku?: string): Promise<boolean> {
  try {
    // TODO(backend): POST /iap/grant 엔드포인트 경로 확정
    await api('/iap/grant', { method: 'POST', json: { orderId, sku } });
    return true;
  } catch (e) {
    console.error('[iap] 지급 실패', orderId, e);
    return false;
  }
}

/**
 * 단건 구매. 결제 후 30초 안에 processProductGrant가 true를 반환해야 함.
 * false면 토스가 '환불 신청' 화면을 띄우고, 주문은 미결로 남아 restorePendingOrders에서 재지급된다.
 */
export function purchase(sku: string): Promise<{ ok: boolean; orderId?: string }> {
  return new Promise((resolve) => {
    const cleanup = IAP.createOneTimePurchaseOrder({
      options: { sku, processProductGrant: ({ orderId }) => grantOnServer(orderId, sku) },
      onEvent: (e) => {
        cleanup();
        resolve({ ok: true, orderId: e.data.orderId });
      },
      onError: (err) => {
        console.warn('[iap] 결제 실패', sku, err);
        cleanup();
        resolve({ ok: false });
      },
    });
  });
}

/** 앱 시작 시 호출: 결제는 됐지만 지급 안 된 주문을 복원 */
export async function restorePendingOrders(): Promise<number> {
  if (!IAP.getPendingOrders.isSupported()) return 0;
  const res = await IAP.getPendingOrders();
  let restored = 0;
  for (const order of res?.orders ?? []) {
    if (await grantOnServer(order.orderId, order.sku)) {
      await IAP.completeProductGrant({ params: { orderId: order.orderId } });
      restored += 1;
    }
  }
  return restored;
}
