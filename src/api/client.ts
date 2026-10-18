import { env } from '@/lib/env';
import { tokenStore } from '@/features/auth/tokenStore';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

type Init = RequestInit & { json?: unknown; auth?: boolean };

/** access 만료(401) 시 1회 재발급 후 재시도. 재발급 로직은 auth 모듈이 주입 */
let refreshHandler: (() => Promise<boolean>) | null = null;
export function setRefreshHandler(fn: () => Promise<boolean>) {
  refreshHandler = fn;
}

async function send(path: string, { json, auth = true, headers, ...rest }: Init): Promise<Response> {
  const access = auth ? tokenStore.getAccess() : null;
  return fetch(`${env.apiBase}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined && { 'Content-Type': 'application/json' }),
      ...(access && { Authorization: `Bearer ${access}` }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

/** 다락방 백엔드(Supabase Edge Functions) 호출. 인증은 Bearer 토큰 (쿠키 사용 안 함) */
export async function api<T>(path: string, init: Init = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && init.auth !== false && refreshHandler && (await refreshHandler())) {
    res = await send(path, init);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error ?? 'unknown');
  return body as T;
}
