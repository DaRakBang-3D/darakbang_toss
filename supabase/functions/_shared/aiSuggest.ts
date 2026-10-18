/**
 * AI 방 꾸미기 추천: 문장 → 무드·색·소품 조합.
 * 모델 출력은 그대로 믿지 않고, 허용 목록으로 검증한 값만 클라이언트에 보낸다.
 * 허용 값은 src/features/editor/catalog.ts 와 같아야 한다.
 */
const URL_ = 'https://api.anthropic.com/v1/messages';
export const ITEM_TYPES = ['bed', 'lamp', 'desk', 'wardrobe', 'chair', 'sofa', 'rug', 'drawer'] as const;
export const MATERIALS = ['matte', 'fabric', 'wood', 'glossy', 'metal'] as const;
export const MOODS = ['morning', 'sunset', 'night'] as const;
const MAX_ITEMS = 6;
const HEX = /^#[0-9a-f]{6}$/i;

export interface RoomSuggestion {
  mood: (typeof MOODS)[number];
  wallColor: string;
  floorColor: string;
  items: {
    type: (typeof ITEM_TYPES)[number];
    variant: 0 | 1;
    material: (typeof MATERIALS)[number];
    color: string;
  }[];
}

export class SuggestError extends Error {}

const SYSTEM = `너는 3D 미니룸 꾸미기 도우미야. 사용자가 원하는 방 분위기를 받아 아래 JSON 하나만 출력해. 설명·코드블록 없이 JSON만.
{"mood": "morning"|"sunset"|"night",
 "wallColor": "#rrggbb", "floorColor": "#rrggbb",
 "items": [{"type": ${ITEM_TYPES.map((t) => `"${t}"`).join('|')}, "variant": 0|1, "material": ${MATERIALS.map((m) => `"${m}"`).join('|')}, "color": "#rrggbb"}]}
규칙: items는 1~${MAX_ITEMS}개. 귀엽고 따뜻한 톤을 기본으로, 요청 분위기에 맞게 색을 고른다. 방 분위기와 무관한 요청이어도 위 형식으로만 답한다.`;

/** 모델 출력 검증. 허용되지 않은 값은 버리고, 핵심 값이 틀리면 실패 */
export function validateSuggestion(raw: unknown): RoomSuggestion {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new SuggestError('not an object');
  const mood = MOODS.find((m) => m === o.mood);
  const wallColor = typeof o.wallColor === 'string' && HEX.test(o.wallColor) ? o.wallColor : null;
  const floorColor = typeof o.floorColor === 'string' && HEX.test(o.floorColor) ? o.floorColor : null;
  if (!mood || !wallColor || !floorColor) throw new SuggestError('invalid mood/colors');

  const items: RoomSuggestion['items'] = [];
  for (const it of Array.isArray(o.items) ? o.items : []) {
    const i = it as Record<string, unknown>;
    const type = ITEM_TYPES.find((t) => t === i.type);
    const material = MATERIALS.find((m) => m === i.material);
    const color = typeof i.color === 'string' && HEX.test(i.color) ? i.color : null;
    if (!type || !material || !color) continue;
    items.push({ type, material, color, variant: i.variant === 1 ? 1 : 0 });
    if (items.length >= MAX_ITEMS) break;
  }
  if (items.length === 0) throw new SuggestError('no valid items');
  return { mood, wallColor, floorColor, items };
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: Fetcher = (url, init) => fetch(url, init);

/** 테스트 전용: 가짜 fetch 주입 */
export function __setAiFetcherForTest(f: Fetcher) {
  fetcher = f;
}

export async function suggestRoom(prompt: string): Promise<RoomSuggestion> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new SuggestError('ANTHROPIC_API_KEY 미설정');
  const res = await fetcher(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new SuggestError(`http ${res.status}`);
  const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const text = body?.content?.find((c) => c.type === 'text')?.text ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SuggestError('no json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new SuggestError('bad json');
  }
  return validateSuggestion(parsed);
}
