/** 하루 단위 집계의 기준일 (한국 시간). 'YYYY-MM-DD' */
export function kstDay(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}
