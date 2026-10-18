/**
 * 방 저장 (사용자당 1개)
 *  GET /rooms/me          → { data } | null
 *  PUT /rooms/me { name, data } → { ok: true }
 */
import { cors, json } from '../_shared/http.ts';
import { db, verifyAccess } from '../_shared/session.ts';

const MAX_BYTES = 64 * 1024; // 소품 40개 + 메타데이터면 충분. 그 이상은 비정상 요청
const NAME_MAX = 12;

async function getMine(req: Request, userId: string) {
  const { data, error } = await db.from('toss_rooms').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return json(req, 200, data ? { data: data.data } : null);
}

async function putMine(req: Request, userId: string) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return json(req, 413, { error: 'room_too_large' });
  let body: { name?: unknown; data?: { version?: unknown } };
  try {
    body = JSON.parse(text);
  } catch {
    return json(req, 400, { error: 'bad_json' });
  }
  if (!body.data || body.data.version !== 2) return json(req, 400, { error: 'bad_room' });
  const name = typeof body.name === 'string' ? body.name.slice(0, NAME_MAX) : '';

  const { error } = await db
    .from('toss_rooms')
    .upsert({ user_id: userId, name, data: body.data, updated_at: new Date().toISOString() });
  if (error) throw error;
  return json(req, 200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const userId = await verifyAccess(req);
    if (!userId) return json(req, 401, { error: 'unauthorized' });
    const path = new URL(req.url).pathname.replace(/^.*\/rooms/, '') || '/';
    if (path === '/me' && req.method === 'GET') return await getMine(req, userId);
    if (path === '/me' && req.method === 'PUT') return await putMine(req, userId);
    return json(req, 404, { error: 'not_found' });
  } catch (e) {
    console.error('[rooms]', e);
    return json(req, 500, { error: 'internal' });
  }
});
