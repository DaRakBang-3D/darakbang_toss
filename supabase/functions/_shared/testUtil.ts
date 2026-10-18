/** 테스트 공용 도우미 (jsr 레지스트리 없이 node:assert만 사용) */

/** 지정한 에러 타입으로 reject 되는지 확인하고 그 에러를 돌려준다 */
export async function assertRejects<E extends Error>(
  fn: () => Promise<unknown>,
  Type: new (...a: never[]) => E,
): Promise<E> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Type) return e;
    throw new Error(`다른 에러: ${e}`);
  }
  throw new Error('reject 되지 않음');
}

/** 고정 응답을 돌려주는 가짜 fetch. 받은 요청을 seen에 기록 */
export function fakeFetch(status: number, body: unknown) {
  const seen: { url: string; init: RequestInit }[] = [];
  const f = (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { f, seen };
}
