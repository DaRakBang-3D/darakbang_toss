import { jwtVerify, SignJWT } from 'npm:jose@5.9.6';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const ACCESS_TTL_SEC = 60 * 60; // 1시간
const REFRESH_TTL_DAYS = 30;
const secret = () => new TextEncoder().encode(Deno.env.get('APP_JWT_SECRET')!);

export interface AppUser {
  id: string;
  tossLinked: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AppUser;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
}

export async function issueSession(user: AppUser): Promise<Session> {
  const accessToken = await new SignJWT({ tl: user.tossLinked })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret());

  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 864e5).toISOString();
  const { error } = await db
    .from('toss_refresh_tokens')
    .insert({ token_hash: await sha256(refreshToken), user_id: user.id, expires_at: expiresAt });
  if (error) throw error;

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, user };
}

/** refresh 토큰 교체(rotation): 쓴 토큰은 즉시 폐기 */
export async function rotateRefresh(refreshToken: string): Promise<Session | null> {
  const hash = await sha256(refreshToken);
  const { data } = await db
    .from('toss_refresh_tokens')
    .delete()
    .eq('token_hash', hash)
    .select('user_id, expires_at')
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const user = await getUser(data.user_id);
  return user ? issueSession(user) : null;
}

export async function verifyAccess(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function getUser(id: string): Promise<AppUser | null> {
  const { data } = await db.from('toss_users').select('id, toss_user_key').eq('id', id).maybeSingle();
  return data ? { id: data.id, tossLinked: data.toss_user_key !== null } : null;
}
