import { api, ApiError } from '@/api/client';
import type { RoomSuggestion } from './roomStore';

/** 프롬프트 최대 길이 (서버도 같은 값으로 자름) */
export const AI_PROMPT_MAX = 60;

export type SuggestResult =
  | { ok: true; suggestion: RoomSuggestion; remaining: number }
  | { ok: false; reason: 'no_quota' | 'failed'; remaining?: number };

/**
 * "비 오는 날 아늑한 방" → 무드·색·소품 조합 추천.
 * 생성권 차감·환불과 응답 검증(허용된 소품·재질만)은 서버가 한다.
 */
export async function requestSuggestion(prompt: string): Promise<SuggestResult> {
  try {
    const r = await api<{ suggestion: RoomSuggestion; remaining: number }>('/ai/recommend', {
      method: 'POST',
      json: { prompt: prompt.trim().slice(0, AI_PROMPT_MAX) },
    });
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'no_quota')
      return { ok: false, reason: 'no_quota', remaining: 0 };
    console.warn('[ai] 추천 실패', e);
    return { ok: false, reason: 'failed' };
  }
}
