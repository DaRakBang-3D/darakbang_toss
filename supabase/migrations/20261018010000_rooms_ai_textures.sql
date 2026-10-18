-- 방 저장 / AI 생성권 / 사진 텍스처 (MVP)
-- 모든 테이블: RLS on, 정책 없음 = Edge Function(service role) 전용

-- 방: 사용자당 1개 (MVP)
create table public.toss_rooms (
  user_id uuid primary key references public.toss_users (id) on delete cascade,
  name text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.toss_rooms enable row level security;

-- AI 생성권: 하루 단위 (KST). 무료 횟수는 함수 인자로 받아 코드와 한곳에서 관리
create table public.toss_ai_usage (
  user_id uuid not null references public.toss_users (id) on delete cascade,
  day date not null,
  free_used int not null default 0,
  ad_earned int not null default 0,
  ad_used int not null default 0,
  primary key (user_id, day)
);
alter table public.toss_ai_usage enable row level security;

-- 1회 차감 (무료 먼저, 다음 광고 보상). 남은 횟수 반환, 없으면 -1. 행 잠금으로 동시 요청에도 안전
create function public.toss_ai_consume(p_user uuid, p_day date, p_free int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.toss_ai_usage;
begin
  insert into toss_ai_usage (user_id, day) values (p_user, p_day) on conflict do nothing;
  select * into r from toss_ai_usage where user_id = p_user and day = p_day for update;
  if r.free_used < p_free then
    r.free_used := r.free_used + 1;
  elsif r.ad_used < r.ad_earned then
    r.ad_used := r.ad_used + 1;
  else
    return -1;
  end if;
  update toss_ai_usage set free_used = r.free_used, ad_used = r.ad_used where user_id = p_user and day = p_day;
  return greatest(p_free - r.free_used, 0) + (r.ad_earned - r.ad_used);
end;
$$;

-- AI 호출 실패 시 환불 (광고분 먼저 되돌림)
create function public.toss_ai_refund(p_user uuid, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update toss_ai_usage
  set ad_used = case when ad_used > 0 then ad_used - 1 else ad_used end,
      free_used = case when ad_used = 0 and free_used > 0 then free_used - 1 else free_used end
  where user_id = p_user and day = p_day;
$$;

-- 보상형 광고 +1. 하루 상한(p_cap) 넘으면 -1
create function public.toss_ai_grant_ad(p_user uuid, p_day date, p_free int, p_cap int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.toss_ai_usage;
begin
  insert into toss_ai_usage (user_id, day) values (p_user, p_day) on conflict do nothing;
  select * into r from toss_ai_usage where user_id = p_user and day = p_day for update;
  if r.ad_earned >= p_cap then
    return -1;
  end if;
  update toss_ai_usage set ad_earned = ad_earned + 1 where user_id = p_user and day = p_day;
  return greatest(p_free - r.free_used, 0) + (r.ad_earned + 1 - r.ad_used);
end;
$$;

revoke execute on function public.toss_ai_consume(uuid, date, int) from public, anon, authenticated;
revoke execute on function public.toss_ai_refund(uuid, date) from public, anon, authenticated;
revoke execute on function public.toss_ai_grant_ad(uuid, date, int, int) from public, anon, authenticated;

-- 사진 텍스처: 검사 결과(거부 포함)를 남겨 신고·감사 대응
create table public.toss_textures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.toss_users (id) on delete cascade,
  slot text not null check (slot in ('wall', 'floor', 'fabric')),
  path text,
  status text not null check (status in ('approved', 'rejected')),
  flagged_categories text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index toss_textures_user_idx on public.toss_textures (user_id, slot);
alter table public.toss_textures enable row level security;

-- 비공개 버킷 (서명 URL로만 접근)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toss-textures', 'toss-textures', false, 400000, array['image/jpeg'])
on conflict (id) do nothing;
