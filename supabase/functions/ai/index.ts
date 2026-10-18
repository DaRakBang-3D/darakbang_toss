/**
 * AI 생성권 + 추천
 *  GET  /ai/quota            → { remaining }
 *  POST /ai/quota/ad-reward  → { remaining }  (보상형 광고 시청 후, 하루 상한 검사)
 *  POST /ai/recommend { prompt } → { suggestion, remaining }  (1회 차감, AI 실패 시 환불)
 */
import { suggestRoom, SuggestError } from '../_shared/aiSuggest.ts';
import { kstDay } from '../_shared/day.ts';
import { cors, json } from '../_shared/http.ts';
import { db, verifyAccess } from '../_shared/session.ts';

/** 클라이언트 FREE_DAILY 와 같은 값 */
const FREE_DAILY = 3;
/** 광고로 받을 수 있는 하루 최대 횟수 (광고 남용·원가 보호) */
const AD_DAILY_CAP = 5;
const PROMPT_MAX = 60;

async function quota(req: Request, userId: string) {
  const { data, error } = await db
    .from('toss_ai_usage')
    .select('free_used, ad_earned, ad_used')
    .eq('user_id', userId)
    .eq('day', kstDay())
    .maybeSingle();
  if (error) throw error;
  const u = data ?? { free_used: 0, ad_earned: 0, ad_used: 0 };
  return json(req, 200, { remaining: Math.max(FREE_DAILY - u.free_used, 0) + (u.ad_earned - u.ad_used) });
}

async function adReward(req: Request, userId: string) {
  // TODO(backend): 토스 광고 서버 검증(SSV)이 제공되면 여기서 확인. 지금은 하루 상한으로 남용 제한
  const { data, error } = await db.rpc('toss_ai_grant_ad', {
    p_user: userId,
    p_day: kstDay(),
    p_free: FREE_DAILY,
    p_cap: AD_DAILY_CAP,
  });
  if (error) throw error;
  if (data === -1) return json(req, 429, { error: 'ad_cap' });
  return json(req, 200, { remaining: data });
}

async function recommend(req: Request, userId: string) {
  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || !prompt.trim()) return json(req, 400, { error: 'prompt_required' });

  const day = kstDay();
  const { data: remaining, error } = await db.rpc('toss_ai_consume', {
    p_user: userId,
    p_day: day,
    p_free: FREE_DAILY,
  });
  if (error) throw error;
  if (remaining === -1) return json(req, 429, { error: 'no_quota' });

  try {
    const suggestion = await suggestRoom(prompt.trim().slice(0, PROMPT_MAX));
    return json(req, 200, { suggestion, remaining });
  } catch (e) {
    // 우리 쪽 실패로 생성권을 잃지 않게 환불
    await db.rpc('toss_ai_refund', { p_user: userId, p_day: day });
    if (e instanceof SuggestError) {
      console.warn('[ai] 추천 실패', e.message);
      return json(req, 502, { error: 'ai_failed' });
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const userId = await verifyAccess(req);
    if (!userId) return json(req, 401, { error: 'unauthorized' });
    const path = new URL(req.url).pathname.replace(/^.*\/ai/, '') || '/';
    const route = `${req.method} ${path}`;
    if (route === 'GET /quota') return await quota(req, userId);
    if (route === 'POST /quota/ad-reward') return await adReward(req, userId);
    if (route === 'POST /recommend') return await recommend(req, userId);
    return json(req, 404, { error: 'not_found' });
  } catch (e) {
    console.error('[ai]', e);
    return json(req, 500, { error: 'internal' });
  }
});
