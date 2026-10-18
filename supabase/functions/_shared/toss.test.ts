/**
 * 파트너 API 응답 처리 테스트 (가짜 mTLS fetch).
 * 실행: cd supabase/functions && deno test --allow-env
 */
import { deepStrictEqual as assertEquals } from 'node:assert/strict';
import { __setTossFetcherForTest, exchangeAnonCode, exchangeTossLogin, TossApiError } from './toss.ts';

/** 지정한 에러 타입으로 reject 되는지 확인하고 그 에러를 돌려준다 */
async function assertRejects<E extends Error>(
  fn: () => Promise<unknown>,
  Type: new (...a: never[]) => E,
): Promise<E> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Type) return e;
    throw new Error(`다른 에러: ${e}`);
  }
  throw new Error('reject 되지 않음');
}

type Seen = { url: string; method?: string; headers: Headers; body?: string };

function fake(routes: Record<string, { status?: number; body: unknown }>) {
  const seen: Seen[] = [];
  __setTossFetcherForTest((url, init) => {
    seen.push({ url, method: init.method, headers: new Headers(init.headers), body: init.body as string });
    const path = new URL(url).pathname;
    const r = routes[path];
    if (!r) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status ?? 200 }));
  });
  return seen;
}

const ANON = '/api-partner/v1/apps-in-toss/users/anon-key/exchange';
const TOKEN = '/api-partner/v1/apps-in-toss/user/oauth2/generate-token';
const ME = '/api-partner/v1/apps-in-toss/user/oauth2/login-me';

Deno.test('식별키 교환 SUCCESS → anonKey, 요청 형식이 문서와 같음', async () => {
  const seen = fake({ [ANON]: { body: { resultType: 'SUCCESS', success: { anonKey: 'k1' } } } });
  assertEquals(await exchangeAnonCode('code-1'), 'k1');
  assertEquals(seen[0]!.method, 'POST');
  assertEquals(JSON.parse(seen[0]!.body!), { code: 'code-1' });
});

Deno.test('HTTP 200 + resultType FAIL(4011) → 거부', async () => {
  fake({
    [ANON]: { body: { resultType: 'FAIL', success: null, error: { errorCode: 4011, reason: 'invalid' } } },
  });
  const e = await assertRejects(() => exchangeAnonCode('bad'), TossApiError);
  assertEquals(e.code, '4011');
});

Deno.test('HTTP 500 → 거부', async () => {
  fake({ [ANON]: { status: 500, body: { resultType: 'INTERNAL_ERROR', success: null } } });
  await assertRejects(() => exchangeAnonCode('x'), TossApiError);
});

Deno.test('토스 로그인: 두 호출 모두 SUCCESS → userKey, login-me에 Bearer 전달', async () => {
  const seen = fake({
    [TOKEN]: { body: { resultType: 'SUCCESS', success: { accessToken: 'at-1', refreshToken: 'rt' } } },
    [ME]: { body: { resultType: 'SUCCESS', success: { userKey: 443731104, scope: 'user_key' } } },
  });
  assertEquals(await exchangeTossLogin('auth-code', 'DEFAULT'), 443731104);
  assertEquals(JSON.parse(seen[0]!.body!), { authorizationCode: 'auth-code', referrer: 'DEFAULT' });
  assertEquals(seen[1]!.method, 'GET');
  assertEquals(seen[1]!.headers.get('Authorization'), 'Bearer at-1');
});

Deno.test('토스 로그인: 봉투 없는 {"error":"invalid_grant"} → 거부', async () => {
  fake({ [TOKEN]: { status: 400, body: { error: 'invalid_grant' } } });
  const e = await assertRejects(() => exchangeTossLogin('used', 'DEFAULT'), TossApiError);
  assertEquals(e.code, 'invalid_grant');
});

Deno.test('토스 로그인 미등록(4050) → 거부', async () => {
  fake({ [TOKEN]: { body: { resultType: 'FAIL', success: null, error: { errorCode: '4050' } } } });
  await assertRejects(() => exchangeTossLogin('c', 'DEFAULT'), TossApiError);
});
