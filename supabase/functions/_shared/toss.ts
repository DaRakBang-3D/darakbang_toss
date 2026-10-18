/**
 * 앱인토스 파트너 API 클라이언트 (mTLS).
 * 인증서는 콘솔 > 개발 > mTLS 인증서에서 발급 → Supabase secrets에 PEM 문자열로 저장.
 */
const BASE = 'https://apps-in-toss-api.toss.im';

let client: Deno.HttpClient | null = null;
function mtls(): Deno.HttpClient {
  if (!client) {
    const cert = Deno.env.get('TOSS_MTLS_CERT');
    const key = Deno.env.get('TOSS_MTLS_KEY');
    if (!cert || !key) throw new Error('TOSS_MTLS_CERT / TOSS_MTLS_KEY 미설정');
    client = Deno.createHttpClient({ cert, key });
  }
  return client;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** 파트너 API는 반드시 mTLS 클라이언트로 호출 (전역 fetch 그대로 쓰면 인증서가 안 실림) */
let fetcher: Fetcher = (url, init) =>
  fetch(url, { ...init, client: mtls() } as RequestInit & { client: Deno.HttpClient });

/** 테스트 전용: 가짜 mTLS fetch 주입 (로그인 우회 플래그 대신 이 방식으로 검증) */
export function __setTossFetcherForTest(f: Fetcher) {
  fetcher = f;
}

type Envelope<T> =
  | { resultType: 'SUCCESS'; success: T }
  | { resultType: string; success: null; error?: { errorCode?: string | number; reason?: string } };

export class TossApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetcher(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => null);
  // 토스 로그인 API는 { error: 'invalid_grant' } 형태로 실패를 주기도 함
  if (body && typeof body.error === 'string') throw new TossApiError(body.error, body.error);
  // 비즈니스 오류는 HTTP 200 + resultType FAIL → resultType 반드시 확인
  const env = body as Envelope<T> | null;
  if (!res.ok || !env || env.resultType !== 'SUCCESS') {
    const err = env && 'error' in env ? env.error : undefined;
    throw new TossApiError(String(err?.errorCode ?? res.status), err?.reason ?? 'toss api error');
  }
  return env.success as T;
}

/** 사용자 식별키 인증 코드(5분, 1회용) → anonKey */
export async function exchangeAnonCode(code: string): Promise<string> {
  const r = await call<{ anonKey: string }>('/api-partner/v1/apps-in-toss/users/anon-key/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return r.anonKey;
}

/**
 * 토스 로그인 인가 코드(10분, 1회용) → userKey.
 * 토스 AccessToken은 userKey 조회에만 쓰고 저장하지 않는다 (민감정보 최소 보관).
 */
export async function exchangeTossLogin(authorizationCode: string, referrer: string): Promise<number> {
  const token = await call<{ accessToken: string }>(
    '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
    {
      method: 'POST',
      body: JSON.stringify({ authorizationCode, referrer }),
    },
  );
  const me = await call<{ userKey: number }>('/api-partner/v1/apps-in-toss/user/oauth2/login-me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  return me.userKey;
}
