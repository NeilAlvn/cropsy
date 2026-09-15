-- 0005 — per-user daily quota for the paid third-party proxies (PRD Phase 4)
--
-- identify/diagnose calls cost money and run on vendors' servers, so every
-- call is counted per user per day. Written by the API with the service key;
-- users can read their own counters, never write them.
create table if not exists public.api_usage (
  owner   uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  kind    text not null check (kind in ('identify', 'diagnose')),
  count   int  not null default 0,
  primary key (owner, day, kind)
);
alter table public.api_usage enable row level security;
drop policy if exists api_usage_owner_read on public.api_usage;
create policy api_usage_owner_read on public.api_usage
  for select to authenticated using (owner = (select auth.uid()));
revoke all on public.api_usage from anon, authenticated;
grant select on public.api_usage to authenticated;

-- Atomic increment; returns the new count for today.
create or replace function public.bump_api_usage(p_owner uuid, p_kind text)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.api_usage (owner, day, kind, count)
  values (p_owner, current_date, p_kind, 1)
  on conflict (owner, day, kind) do update set count = public.api_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_api_usage(uuid, text) from public, anon, authenticated;
