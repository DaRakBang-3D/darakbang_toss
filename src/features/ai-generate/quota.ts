import { create } from 'zustand';
import { api } from '@/api/client';

/** 하루 무료 생성 횟수 (기획 확정값). 서버 supabase/functions/ai 와 같은 값 */
export const FREE_DAILY = 3;

interface QuotaState {
  /** 남은 AI 생성권 (무료 + 광고). 진짜 값은 서버가 관리하고 여기는 캐시 */
  remaining: number;
  /** 서버에서 값을 한 번이라도 받았는지 (미연결 상태 표시용) */
  known: boolean;
  refresh: () => Promise<void>;
  /** 보상형 광고 시청 완료 → 서버에 +1 요청 (하루 상한은 서버가 검사) */
  grantFromAd: () => Promise<void>;
  /** 추천 응답 등 다른 서버 응답에 실려 온 잔량 반영 */
  setRemaining: (remaining: number) => void;
}

export const useQuota = create<QuotaState>((set) => ({
  remaining: 0,
  known: false,
  refresh: async () => {
    const { remaining } = await api<{ remaining: number }>('/ai/quota');
    set({ remaining, known: true });
  },
  grantFromAd: async () => {
    const { remaining } = await api<{ remaining: number }>('/ai/quota/ad-reward', { method: 'POST' });
    set({ remaining, known: true });
  },
  setRemaining: (remaining) => set({ remaining, known: true }),
}));
