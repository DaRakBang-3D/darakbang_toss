import { deepStrictEqual as assertEquals } from 'node:assert/strict';
import { __setModerationFetcherForTest, moderateImage, ModerationUnavailable } from './moderation.ts';
import { assertRejects, fakeFetch } from './testUtil.ts';

Deno.test('키 없으면 검사 불가 (→ 클라이언트 내 폰 전용 모드)', async () => {
  Deno.env.delete('OPENAI_API_KEY');
  await assertRejects(() => moderateImage('AAAA'), ModerationUnavailable);
});

Deno.test('통과 이미지: flagged false, 요청에 data URI 이미지 포함', async () => {
  Deno.env.set('OPENAI_API_KEY', 'test');
  const { f, seen } = fakeFetch(200, { results: [{ flagged: false, categories: { sexual: false } }] });
  __setModerationFetcherForTest(f);
  assertEquals(await moderateImage('AAAA'), { flagged: false, categories: [] });
  const body = JSON.parse(seen[0]!.init.body as string);
  assertEquals(body.input[0].image_url.url, 'data:image/jpeg;base64,AAAA');
});

Deno.test('부적절 이미지: flagged true + 걸린 항목', async () => {
  Deno.env.set('OPENAI_API_KEY', 'test');
  __setModerationFetcherForTest(
    fakeFetch(200, { results: [{ flagged: true, categories: { sexual: true, violence: false } }] }).f,
  );
  assertEquals(await moderateImage('AAAA'), { flagged: true, categories: ['sexual'] });
});

Deno.test('검사 서버 오류·이상한 응답은 통과시키지 않음', async () => {
  Deno.env.set('OPENAI_API_KEY', 'test');
  __setModerationFetcherForTest(fakeFetch(500, {}).f);
  await assertRejects(() => moderateImage('AAAA'), ModerationUnavailable);
  __setModerationFetcherForTest(fakeFetch(200, { results: [] }).f);
  await assertRejects(() => moderateImage('AAAA'), ModerationUnavailable);
});
