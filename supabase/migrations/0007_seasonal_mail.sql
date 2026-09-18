-- 0007 — seasonal mail: who may be mailed, and what their season looked like
--
-- Consent lives in `profiles.preferences->>'mail_optin'` (an ISO timestamp, set
-- by the Settings toggle) rather than in a column of its own: preferences
-- already syncs from the app, so the answer travels with the account and no
-- client schema has to change to carry it.
--
-- Both functions are SECURITY DEFINER because they read auth.users, which is
-- not exposed through the API. Neither is granted to anon or authenticated, so
-- only the service key the mailer uses can call them.

-- Everyone who said yes and still has a mailbox.
create or replace function public.mail_recipients()
returns table (id uuid, email text, lang text)
language sql
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.lang
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.deleted_at is null
    and u.email is not null
    and coalesce(p.preferences ->> 'mail_optin', '') <> ''
$$;
revoke all on function public.mail_recipients() from anon, authenticated, public;

-- What a grower actually harvested in a season, for the October recap. Returns
-- one row per opted-in user who logged at least one harvest that year; growers
-- with nothing to show get no mail rather than an empty one.
create or replace function public.season_recap(p_year int)
returns table (
  id            uuid,
  email         text,
  lang          text,
  harvests      bigint,
  kg            numeric,
  pieces        numeric,
  crops         bigint,
  top_crop      text
)
language sql
security definer
set search_path = ''
as $$
  with mine as (
    select h.owner,
           h.amount,
           h.unit,
           gp.crop_slug
    from public.harvests h
    join public.garden_plants gp
      on gp.id = h.garden_plant_id and gp.owner = h.owner
    where h.deleted_at is null
      and extract(year from h.harvested_on) = p_year
  ),
  ranked as (
    select owner, crop_slug, count(*) as n,
           row_number() over (partition by owner order by count(*) desc, crop_slug) as rank
    from mine
    group by owner, crop_slug
  )
  select r.id,
         r.email,
         r.lang,
         count(m.*)                                                as harvests,
         coalesce(sum(m.amount) filter (where m.unit = 'kg'), 0)   as kg,
         coalesce(sum(m.amount) filter (where m.unit = 'pcs'), 0)  as pieces,
         count(distinct m.crop_slug)                               as crops,
         max(t.crop_slug)                                          as top_crop
  from public.mail_recipients() r
  join mine m on m.owner = r.id
  left join ranked t on t.owner = r.id and t.rank = 1
  group by r.id, r.email, r.lang
$$;
revoke all on function public.season_recap(int) from anon, authenticated, public;

-- One click in the mail has to be enough to stop it, and the person clicking is
-- not signed in, so this runs with the service key from the unsubscribe route.
create or replace function public.mail_optout(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set preferences = preferences - 'mail_optin',
         updated_at = now()
   where id = p_id
$$;
revoke all on function public.mail_optout(uuid) from anon, authenticated, public;

-- What has already gone out. The cron runs every day and the window is a few
-- days wide, so without this a subscriber would get the same mail each morning
-- until the window closed.
create table if not exists public.mail_log (
  kind       text not null check (kind in ('season_opener', 'harvest_recap')),
  year       int  not null,
  sent_at    timestamptz not null default now(),
  recipients int  not null default 0,
  primary key (kind, year)
);
alter table public.mail_log enable row level security;
revoke all on public.mail_log from anon, authenticated;
