/**
 * 인증 엔드포인트 (자체 JWT)
 *  POST /auth/anon     { code }                         → 0단계: 식별키로 진입 (동의 화면·개인정보 없음)
 *  POST /auth/toss     { authorizationCode, referrer }  → 1단계: 토스 로그인 연결 (Bearer 필요)
 *  POST /auth/refresh  { refreshToken }                 → 토큰 재발급(교체)
 */
import { cors, json } from '../_shared/http.ts';
import { db, getUser, issueSession, rotateRefresh, verifyAccess } from '../_shared/session.ts';
import { exchangeAnonCode, exchangeTossLogin, TossApiError } from '../_shared/toss.ts';

async function anon(req: Request) {
  const { code } = await req.json();
  if (typeof code !== 'string') return json(req, 400, { error: 'code_required' });

  const anonKey = await exchangeAnonCode(code); // 클라이언트가 보낸 키는 믿지 않고 교환 결과만 사용
  const { data, error } = await db
    .from('toss_users')
    .upsert({ anon_key: anonKey }, { onConflict: 'anon_key', ignoreDuplicates: false })
    .select('id, toss_user_key')
    .single();
  if (error) throw error;

  return json(req, 200, await issueSession({ id: data.id, tossLinked: data.toss_user_key !== null }));
}

async function toss(req: Request) {
  const userId = await verifyAccess(req);
  if (!userId) return json(req, 401, { error: 'unauthorized' });
  const { authorizationCode, referrer } = await req.json();
  if (typeof authorizationCode !== 'string' || typeof referrer !== 'string') {
    return json(req, 400, { error: 'code_required' });
  }

  const userKey = await exchangeTossLogin(authorizationCode, referrer);
  // 같은 토스 사용자는 같은 anonKey를 받으므로 현재 사용자에 바로 연결
  const { error } = await db
    .from('toss_users')
    .update({ toss_user_key: userKey, toss_linked_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) {
    // 23505: 이미 다른 계정에 연결된 userKey (정상 흐름에선 발생하지 않음)
    if (error.code === '23505') return json(req, 409, { error: 'toss_already_linked' });
    throw error;
  }
  return json(req, 200, await issueSession({ id: userId, tossLinked: true }));
}

async function refresh(req: Request) {
  const { refreshToken } = await req.json();
  if (typeof refreshToken !== 'string') return json(req, 400, { error: 'refresh_required' });
  const session = await rotateRefresh(refreshToken);
  return session ? json(req, 200, session) : json(req, 401, { error: 'invalid_refresh' });
}

async function me(req: Request) {
  const userId = await verifyAccess(req);
  const user = userId && (await getUser(userId));
  return user ? json(req, 200, user) : json(req, 401, { error: 'unauthorized' });
}

const routes: Record<string, (req: Request) => Promise<Response>> = {
  'POST /anon': anon,
  'POST /toss': toss,
  'POST /refresh': refresh,
  'GET /me': me,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const path = new URL(req.url).pathname.replace(/^.*\/auth/, '') || '/';
  const handler = routes[`${req.method} ${path}`];
  if (!handler) return json(req, 404, { error: 'not_found' });
  try {
    return await handler(req);
  } catch (e) {
    if (e instanceof TossApiError) {
      console.warn('[auth] toss api', e.code, e.message);
      return json(req, 400, { error: 'toss_exchange_failed', code: e.code });
    }
    console.error('[auth]', e);
    return json(req, 500, { error: 'internal' });
  }
});
