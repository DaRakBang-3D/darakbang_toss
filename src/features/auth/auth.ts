import { appLogin, User } from '@apps-in-toss/web-framework';
import { create } from 'zustand';
import { api, setRefreshHandler } from '@/api/client';
import { features } from '@/lib/env';
import { tokenStore } from './tokenStore';

export interface AppUser {
  id: string;
  /** 토스 로그인까지 연결됐는지 (결제 가능 여부) */
  tossLinked: boolean;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AppUser;
}

interface AuthState {
  user: AppUser | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** 0단계: 앱 진입 시 자동. 동의 화면 없음 */
  bootstrap: () => Promise<void>;
  /** 1단계: 결제 직전에만 호출. 이미 연결돼 있으면 바로 true */
  ensureTossLinked: () => Promise<boolean>;
}

async function applySession(s: Session) {
  tokenStore.setAccess(s.accessToken);
  await tokenStore.setRefresh(s.refreshToken);
  useAuth.setState({ user: s.user, status: 'ready' });
}

let refreshing: Promise<boolean> | null = null;
/** 동시에 여러 요청이 401을 받아도 재발급은 한 번만 */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) return false;
    try {
      await applySession(
        await api<Session>('/auth/refresh', { method: 'POST', json: { refreshToken }, auth: false }),
      );
      return true;
    } catch {
      await tokenStore.clear();
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
setRefreshHandler(refresh);

async function signInAnon() {
  // 인증 코드는 5분·1회용 → 받자마자 서버로 전달하고 저장하지 않음
  const { code } = await User.createAnonymousKeyAuthCode();
  await applySession(await api<Session>('/auth/anon', { method: 'POST', json: { code }, auth: false }));
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',

  bootstrap: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      if (!(await refresh())) await signInAnon();
    } catch (e) {
      console.error('[auth] 진입 인증 실패', e);
      set({ status: 'error' });
    }
  },

  ensureTossLinked: async () => {
    if (get().user?.tossLinked) return true;
    // 토스 로그인은 사업자 등록이 필요 → 결제 기능과 함께 켜짐
    if (!features.payments) return false;
    try {
      // 토스 로그인 약관 동의 화면 (처음 1회). 인가 코드는 10분·1회용
      const { authorizationCode, referrer } = await appLogin();
      await applySession(
        await api<Session>('/auth/toss', { method: 'POST', json: { authorizationCode, referrer } }),
      );
      return true;
    } catch (e) {
      console.warn('[auth] 토스 로그인 취소/실패', e);
      return false;
    }
  },
}));
