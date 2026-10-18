import { create } from 'zustand';
import { api } from '@/api/client';

/** 하루 무료 생성 횟수 (기획 확정값) */
export const FREE_DAILY = 3;

interface QuotaState {
  /** 남은 AI 생성권 (무료 + 광고 + 구매 합산). 진짜 값은 서버가 관리 */
  remaining: number;
  refresh: () => Promise<void>;
  /** 보상형 광고 시청 완료 → 서버에 +1 요청 */
  grantFromAd: () => Promise<void>;
}

export const useQuota = create<QuotaState>((set) => ({
  remaining: 0,
  refresh: async () => {
    // TODO(backend): GET /ai/quota
    const { remaining } = await api<{ remaining: number }>('/ai/quota');
    set({ remaining });
  },
  grantFromAd: async () => {
    // TODO(backend): POST /ai/quota/ad-reward (서버에서 하루 상한 검사)
    const { remaining } = await api<{ remaining: number }>('/ai/quota/ad-reward', { method: 'POST' });
    set({ remaining });
  },
}));
