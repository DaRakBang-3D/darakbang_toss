/** 앱인토스 WebView Origin (SDK 3.1+). 로컬 개발용 origin은 ALLOWED_DEV_ORIGINS로 추가 */
const APP = 'darakbang';
const ORIGINS = new Set([
  `https://${APP}.apps.tossmini.com`,
  `https://${APP}.private-apps.tossmini.com`,
  ...(Deno.env.get('ALLOWED_DEV_ORIGINS')?.split(',').filter(Boolean) ?? []),
]);

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return ORIGINS.has(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        Vary: 'Origin',
      }
    : {};
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(req) },
  });
}
