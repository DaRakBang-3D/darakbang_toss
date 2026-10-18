/**
 * 사용자 사진 부적절 콘텐츠 검사.
 * 기본 공급자: OpenAI omni-moderation (이미지 지원). 다른 서비스로 바꾸려면 이 파일만 교체.
 * 키가 없거나 검사 서버 오류면 ModerationUnavailable → 클라이언트는 "내 폰에서만" 모드로 처리.
 */
const URL_ = 'https://api.openai.com/v1/moderations';

export class ModerationUnavailable extends Error {}

export interface ModerationResult {
  flagged: boolean;
  /** 걸린 항목 (감사 기록용) */
  categories: string[];
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: Fetcher = (url, init) => fetch(url, init);

/** 테스트 전용: 가짜 fetch 주입 */
export function __setModerationFetcherForTest(f: Fetcher) {
  fetcher = f;
}

export async function moderateImage(jpegBase64: string): Promise<ModerationResult> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new ModerationUnavailable('OPENAI_API_KEY 미설정');

  let res: Response;
  try {
    res = await fetcher(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } }],
      }),
    });
  } catch (e) {
    throw new ModerationUnavailable(`network: ${e}`);
  }
  if (!res.ok) throw new ModerationUnavailable(`http ${res.status}`);

  const body = (await res.json().catch(() => null)) as {
    results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
  } | null;
  const r = body?.results?.[0];
  // 응답 모양이 다르면 통과시키지 않는다 (안전 쪽으로)
  if (!r || typeof r.flagged !== 'boolean') throw new ModerationUnavailable('unexpected response');
  const categories = Object.entries(r.categories ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  return { flagged: r.flagged, categories };
}
