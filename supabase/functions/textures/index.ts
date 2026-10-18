/**
 * 사용자 사진 텍스처 (벽지·바닥·패브릭)
 *  POST /textures { slot, image(base64 JPEG) } → { id, url }
 *       부적절 판정 → 422 inappropriate_image / 검사 불가 → 503 moderation_unavailable
 *  GET  /textures/:id → { url }  (서명 URL 재발급)
 */
import { cors, json } from '../_shared/http.ts';
import { moderateImage, ModerationUnavailable } from '../_shared/moderation.ts';
import { db, verifyAccess } from '../_shared/session.ts';

const BUCKET = 'toss-textures';
const SLOTS = ['wall', 'floor', 'fabric'];
const MAX_B64 = 540_000; // ≈ 400KB JPEG (클라이언트는 512px로 줄여 보냄 → 보통 100KB 이하)
const URL_TTL_SEC = 7 * 24 * 3600;

async function upload(req: Request, userId: string) {
  const { slot, image } = await req.json().catch(() => ({}));
  if (typeof slot !== 'string' || !SLOTS.includes(slot)) return json(req, 400, { error: 'bad_slot' });
  if (typeof image !== 'string' || image.length > MAX_B64)
    return json(req, 413, { error: 'image_too_large' });

  let verdict;
  try {
    verdict = await moderateImage(image);
  } catch (e) {
    if (e instanceof ModerationUnavailable) {
      console.warn('[textures] 검사 불가', e.message);
      return json(req, 503, { error: 'moderation_unavailable' });
    }
    throw e;
  }
  if (verdict.flagged) {
    // 거부 기록은 남기되 이미지는 저장하지 않음
    await db
      .from('toss_textures')
      .insert({ user_id: userId, slot, status: 'rejected', flagged_categories: verdict.categories });
    return json(req, 422, { error: 'inappropriate_image' });
  }

  const id = crypto.randomUUID();
  const path = `${userId}/${slot}-${id}.jpg`;
  const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;

  // 슬롯당 1장: 이전 사진 정리
  const { data: old } = await db
    .from('toss_textures')
    .select('id, path')
    .eq('user_id', userId)
    .eq('slot', slot)
    .eq('status', 'approved');
  if (old?.length) {
    await db.storage.from(BUCKET).remove(old.map((o) => o.path).filter(Boolean));
    await db
      .from('toss_textures')
      .delete()
      .in(
        'id',
        old.map((o) => o.id),
      );
  }
  const ins = await db.from('toss_textures').insert({ id, user_id: userId, slot, path, status: 'approved' });
  if (ins.error) throw ins.error;

  const signed = await db.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SEC);
  if (signed.error) throw signed.error;
  return json(req, 200, { id, url: signed.data.signedUrl });
}

async function sign(req: Request, userId: string, id: string) {
  // TODO(backend): 친구 방 보기 기능이 생기면 방 주인의 approved 사진도 허용
  const { data } = await db
    .from('toss_textures')
    .select('path')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();
  if (!data?.path) return json(req, 404, { error: 'not_found' });
  const signed = await db.storage.from(BUCKET).createSignedUrl(data.path, URL_TTL_SEC);
  if (signed.error) throw signed.error;
  return json(req, 200, { url: signed.data.signedUrl });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const userId = await verifyAccess(req);
    if (!userId) return json(req, 401, { error: 'unauthorized' });
    const path = new URL(req.url).pathname.replace(/^.*\/textures/, '') || '/';
    if (req.method === 'POST' && path === '/') return await upload(req, userId);
    const m = path.match(/^\/([0-9a-f-]{36})$/);
    if (req.method === 'GET' && m?.[1]) return await sign(req, userId, m[1]);
    return json(req, 404, { error: 'not_found' });
  } catch (e) {
    console.error('[textures]', e);
    return json(req, 500, { error: 'internal' });
  }
});
