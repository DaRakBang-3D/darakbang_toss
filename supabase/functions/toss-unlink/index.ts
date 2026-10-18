/**
 * 토스 로그인 연결 끊기 콜백 (토스 서버 → 우리). 콘솔에 URL·Basic Auth 등록.
 * referrer
 *  - UNLINK / WITHDRAWAL_TERMS : 토스 연결만 해제. 방 데이터는 식별키 계정에 그대로 남김
 *  - WITHDRAWAL_TOSS           : 토스 탈퇴 → 사용자 데이터 삭제
 * 우리 쪽에서 연결 끊기 API를 직접 호출한 경우엔 콜백이 오지 않는다.
 */
import { db } from '../_shared/session.ts';

function authorized(req: Request): boolean {
  const expected = Deno.env.get('TOSS_UNLINK_BASIC_AUTH'); // "user:password"
  const header = req.headers.get('Authorization') ?? '';
  if (!expected || !header.startsWith('Basic ')) return false;
  try {
    return atob(header.slice(6)) === expected;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });

  let userKey: unknown;
  let referrer: unknown;
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    userKey = Number(q.get('userKey'));
    referrer = q.get('referrer');
  } else {
    ({ userKey, referrer } = await req.json());
  }
  if (typeof userKey !== 'number' || !Number.isFinite(userKey))
    return new Response('bad request', { status: 400 });

  const q = db.from('toss_users');
  const { error } =
    referrer === 'WITHDRAWAL_TOSS'
      ? await q.delete().eq('toss_user_key', userKey)
      : await q.update({ toss_user_key: null, toss_linked_at: null }).eq('toss_user_key', userKey);
  if (error) {
    console.error('[toss-unlink]', error);
    return new Response('error', { status: 500 });
  }
  console.info('[toss-unlink]', referrer, userKey);
  return new Response('ok');
});
