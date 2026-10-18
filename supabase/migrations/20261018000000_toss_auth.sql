-- 토스 미니앱 사용자 (2단계 인증)
-- 0단계: anon_key(사용자 식별키)로 진입 즉시 생성. 개인정보 없음
-- 1단계: 결제 시점에 토스 로그인 → toss_user_key 연결
create table public.toss_users (
  id uuid primary key default gen_random_uuid(),
  anon_key text not null unique,
  toss_user_key bigint unique,
  toss_linked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 자체 refresh 토큰 (원문은 저장하지 않고 SHA-256 해시만 저장, 사용 시 교체)
create table public.toss_refresh_tokens (
  token_hash text primary key,
  user_id uuid not null references public.toss_users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index toss_refresh_tokens_user_idx on public.toss_refresh_tokens (user_id);

-- Edge Function(service role)만 접근. 클라이언트 직접 접근 차단
alter table public.toss_users enable row level security;
alter table public.toss_refresh_tokens enable row level security;
