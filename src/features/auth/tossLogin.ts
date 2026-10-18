import { appLogin } from '@apps-in-toss/web-framework';
import { create } from 'zustand';
import { api } from '@/api/client';

export interface Me {
  userId: string;
  nickname: string;
}

interface AuthState {
  me: Me | null;
  status: 'idle' | 'loading' | 'error';
  login: () => Promise<void>;
}

/**
 * 토스 로그인 흐름
 * 1. appLogin()으로 인가 코드(10분 유효, 1회용) 받기
 * 2. 서버에 전달 → 서버가 mTLS로 토큰 교환 + userKey 조회 후 세션 쿠키 발급
 */
export const useAuth = create<AuthState>((set) => ({
  me: null,
  status: 'idle',
  login: async () => {
    set({ status: 'loading' });
    try {
      const { authorizationCode, referrer } = await appLogin();
      // TODO(backend): POST /auth/toss 엔드포인트 경로 확정
      const me = await api<Me>('/auth/toss', { method: 'POST', json: { authorizationCode, referrer } });
      set({ me, status: 'idle' });
    } catch (e) {
      console.error('[auth] 로그인 실패', e);
      set({ status: 'error' });
    }
  },
}));
