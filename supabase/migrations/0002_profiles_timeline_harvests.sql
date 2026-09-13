-- 0002 — profiles, timeline, harvests, feedback (PRD §8.2)
--
-- Extends the 0001 foundation for the Duolingo timeline (planned_due vs due),
-- the onboarding profile, harvest logging and content feedback. Same
-- conventions throughout: owner + updated_at + deleted_at, composite FK to the
-- parent, owner RLS, no delete grant. Idempotent: safe to re-run.

-- ── profiles (one per auth user, auto-created on signup) ───────────────────
-- `id` is the auth.uid. `owner` duplicates it so the sync client can treat this
-- table exactly like every other syncable table (delta pull on owner +
-- updated_at). The CHECK keeps the two from ever diverging.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  owner               uuid not null references auth.users (id) on delete cascade,
  display_name        text,
  lang                text not null default 'nl' check (lang in ('nl', 'en')),
  preferences         jsonb not null default '{}'::jsonb,
  streak_count        int not null default 0,
  streak_frozen_until date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (owner = id)
);

-- Runs as the auth admin on signup, so SECURITY DEFINER is required to write
-- into public. search_path pinned for the same reason as set_updated_at.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, owner) values (new.id, new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for users who signed up before this migration.
insert into public.profiles (id, owner)
select id, id from auth.users
on conflict (id) do nothing;

-- ── gardens: onboarding answers + planner grid ─────────────────────────────
alter table public.gardens
  add column if not exists size_m2  int,
  add column if not exists layout   jsonb,
  add column if not exists postcode text;

-- ── garden_plants: variety, stage, place ────────────────────────────────────
alter table public.garden_plants
  add column if not exists variety_slug     text,
  add column if not exists stage            text,
  add column if not exists stage_changed_on date,
  add column if not exists place            text;

alter table public.garden_plants drop constraint if exists garden_plants_stage_check;
alter table public.garden_plants add constraint garden_plants_stage_check check (
  stage is null or stage in ('starting', 'seedling', 'vegetative', 'flowering', 'harvesting', 'harvested'));

alter table public.garden_plants drop constraint if exists garden_plants_place_check;
alter table public.garden_plants add constraint garden_plants_place_check check (
  place is null or place in ('ground', 'raised_bed', 'indoor_container', 'outdoor_container'));

-- ── tasks: timeline nodes ──────────────────────────────────────────────────
-- planned_due is the ORIGINAL date from the plan; due is where the replan
-- engine moved it. The pair is what lets the timeline say "moved from … to …"
-- instead of "overdue" (PRD §7.2). node_kind mirrors NodeKind in
-- src/timing/replan.ts; `kind` stays the weather-adjust enum.
alter table public.tasks
  add column if not exists node_kind    text,
  add column if not exists planned_due  date,
  add column if not exists moved_reason text,
  add column if not exists skipped      bool not null default false;

alter table public.tasks drop constraint if exists tasks_node_kind_check;
alter table public.tasks add constraint tasks_node_kind_check check (
  node_kind is null or node_kind in ('sow', 'pot_on', 'transplant', 'thin', 'feed', 'water', 'harvest', 'harvested'));

-- ── journal_entries: growth logs ───────────────────────────────────────────
alter table public.journal_entries
  add column if not exists mood        int check (mood between 1 and 4),
  add column if not exists stage       text,
  add column if not exists photo_paths text[] not null default '{}';

-- ── harvests (append-only from the client) ─────────────────────────────────
create table if not exists public.harvests (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null references auth.users (id) on delete cascade,
  garden_plant_id uuid not null,
  harvested_on    date not null,
  amount          numeric not null check (amount >= 0),
  unit            text not null check (unit in ('kg', 'pcs')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  foreign key (garden_plant_id, owner)
    references public.garden_plants (id, owner) on delete cascade
);

-- ── feedback (content like / dislike / error, append-only) ─────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('crop', 'section', 'collection', 'problem', 'checklist')),
  target_id   text not null,
  sentiment   text not null check (sentiment in ('like', 'dislike', 'error', 'suggestion')),
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── plant_ids (Phase 4 scan / diagnose audit trail) ────────────────────────
create table if not exists public.plant_ids (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  photo_path  text,
  result      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── triggers + indexes + RLS, same loop as 0001 ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles', 'harvests', 'feedback', 'plant_ids']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
    execute format(
      'create index if not exists %I_owner_updated on public.%I (owner, updated_at)', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner_rw on public.%I', t, t);
    execute format(
      'create policy %I_owner_rw on public.%I
         for all to authenticated
         using (owner = (select auth.uid()))
         with check (owner = (select auth.uid()))', t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;
