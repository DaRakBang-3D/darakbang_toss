import { deepStrictEqual as assertEquals, throws as assertThrows } from 'node:assert/strict';
import { __setAiFetcherForTest, suggestRoom, SuggestError, validateSuggestion } from './aiSuggest.ts';
import { assertRejects, fakeFetch } from './testUtil.ts';

const GOOD = {
  mood: 'night',
  wallColor: '#334455',
  floorColor: '#aabbcc',
  items: [
    { type: 'bed', variant: 1, material: 'fabric', color: '#f2c6c2' },
    { type: 'lamp', variant: 0, material: 'matte', color: '#f5b83d' },
  ],
};

Deno.test('검증: 정상 응답은 그대로', () => {
  assertEquals(validateSuggestion(GOOD), GOOD);
});

Deno.test('검증: 허용 안 된 소품·재질·색은 버리고 variant는 0/1로', () => {
  const r = validateSuggestion({
    ...GOOD,
    items: [
      { type: 'bookshelf', variant: 0, material: 'wood', color: '#000000' },
      { type: 'chair', variant: 7, material: 'gold', color: '#000000' },
      { type: 'chair', variant: 7, material: 'wood', color: 'red' },
      { type: 'chair', variant: 7, material: 'wood', color: '#123456' },
    ],
  });
  assertEquals(r.items, [{ type: 'chair', variant: 0, material: 'wood', color: '#123456' }]);
});

Deno.test('검증: 소품은 최대 6개', () => {
  const items = Array.from({ length: 10 }, () => GOOD.items[0]);
  assertEquals(validateSuggestion({ ...GOOD, items }).items.length, 6);
});

Deno.test('검증: 무드·색이 틀리거나 소품이 없으면 실패', () => {
  for (const bad of [
    { ...GOOD, mood: 'noon' },
    { ...GOOD, wallColor: 'blue' },
    { ...GOOD, items: [] },
  ]) {
    assertThrows(() => validateSuggestion(bad), SuggestError);
  }
});

Deno.test('호출: 앞뒤 설명이 붙은 텍스트에서도 JSON만 추출, 헤더 형식 확인', async () => {
  Deno.env.set('ANTHROPIC_API_KEY', 'test');
  const { f, seen } = fakeFetch(200, {
    content: [{ type: 'text', text: `좋아! 추천이야:\n${JSON.stringify(GOOD)}\n즐겨!` }],
  });
  __setAiFetcherForTest(f);
  assertEquals(await suggestRoom('밤에 영화 보는 방'), GOOD);
  const h = new Headers(seen[0]!.init.headers);
  assertEquals(h.get('x-api-key'), 'test');
  assertEquals(h.get('anthropic-version'), '2023-06-01');
  assertEquals(JSON.parse(seen[0]!.init.body as string).messages[0].content, '밤에 영화 보는 방');
});

Deno.test('호출: HTTP 오류·JSON 없음·키 없음은 실패 (→ 서버가 생성권 환불)', async () => {
  Deno.env.set('ANTHROPIC_API_KEY', 'test');
  __setAiFetcherForTest(fakeFetch(529, {}).f);
  await assertRejects(() => suggestRoom('x'), SuggestError);
  __setAiFetcherForTest(fakeFetch(200, { content: [{ type: 'text', text: '모르겠어' }] }).f);
  await assertRejects(() => suggestRoom('x'), SuggestError);
  Deno.env.delete('ANTHROPIC_API_KEY');
  await assertRejects(() => suggestRoom('x'), SuggestError);
});
