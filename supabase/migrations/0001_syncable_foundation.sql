-- 0001 — syncable foundation
--
-- Establishes the delta-sync conventions from docs/API-CONTRACT.md §6 before any
-- feature tables exist: every user-owned table gets id + owner + updated_at +
-- deleted_at, an auto-touch trigger, and owner-scoped RLS. This is the seam that
-- makes the Flutter client offline-first and delta-syncing.
--
-- Idempotent throughout: safe to re-run against a partially-applied database.

-- Server-maintained updated_at, so the client can never spoof a sync cursor.
-- SECURITY INVOKER (the default, stated explicitly) and a pinned search_path —
-- an unpinned search_path on a function is what Supabase's advisors flag, and
-- it's the mechanism behind privilege-escalation via shadowed objects.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── gardens ────────────────────────────────────────────────────────────────
create table if not exists public.gardens (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('balcony', 'garden', 'allotment')),
  -- F3 growing situation; the schedule/reminders adapt to this.
  sun_hours   int,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Lets children carry a composite FK on (id, owner) — see below.
  unique (id, owner)
);

-- ── garden_plants (a crop the user is growing, in a garden) ─────────────────
create table if not exists public.garden_plants (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users (id) on delete cascade,
  garden_id    uuid not null,
  crop_slug    text not null,          -- refers to bundled crop reference data
  pot_litres   int,                    -- null = in-ground
  planted_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- Composite FK, not a plain one: RLS only checks that YOU own the new row, so
  -- a plain garden_id FK would happily let you attach your plant to someone
  -- else's garden. Matching on (id, owner) makes cross-owner references
  -- impossible in the database rather than merely unlikely in the client.
  foreign key (garden_id, owner)
    references public.gardens (id, owner) on delete cascade,
  unique (id, owner)
);

-- ── tasks (this-week items) ────────────────────────────────────────────────
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null references auth.users (id) on delete cascade,
  garden_plant_id uuid,
  -- Enum frozen 2026-07-27 with Chris; mirrors TaskKind in
  -- src/timing/weather-adjust.ts. Kept as a CHECK rather than a Postgres enum
  -- so adding a value is an ordinary migration, not a type alteration.
  kind            text not null check (
                    kind in ('water', 'sow', 'transplant', 'harvest',
                             'feed', 'pot_on', 'thin')),
  due             date not null,
  completed_at    timestamptz,          -- back-datable (F4)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  foreign key (garden_plant_id, owner)
    references public.garden_plants (id, owner) on delete cascade
);

-- ── journal_entries (F5 photo journal) ──────────────────────────────────────
create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null references auth.users (id) on delete cascade,
  garden_plant_id uuid,
  entry_on        date not null,        -- back-datable
  note            text,
  photo_path      text,                 -- storage key; compressed client-side
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  foreign key (garden_plant_id, owner)
    references public.garden_plants (id, owner) on delete cascade
);

-- ── triggers + indexes + RLS for every syncable table ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['gardens', 'garden_plants', 'tasks', 'journal_entries']
  loop
    -- CREATE TRIGGER has no IF NOT EXISTS, so drop first to stay re-runnable.
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.set_updated_at()', t, t);

    -- Delta-pull index: owner + updated_at is the hot path (API §6).
    execute format(
      'create index if not exists %I_owner_updated on public.%I (owner, updated_at)', t, t);

    execute format('alter table public.%I enable row level security', t);

    -- Reads and writes are scoped to the owner: TO authenticated for the role,
    -- plus an ownership predicate for the row. The role check alone would be
    -- authentication without authorization — every signed-in user seeing every
    -- row. WITH CHECK mirrors USING so a row can't be reassigned to someone else.
    --
    -- (select auth.uid()) rather than auth.uid() so the planner evaluates it
    -- once per query instead of once per row.
    execute format('drop policy if exists %I_owner_rw on public.%I', t, t);
    execute format(
      'create policy %I_owner_rw on public.%I
         for all to authenticated
         using (owner = (select auth.uid()))
         with check (owner = (select auth.uid()))', t, t);

    -- Deliberately NO delete grant. Every row here is synced, and a hard delete
    -- leaves no tombstone — so the deletion never reaches the user's other
    -- devices and the row silently reappears on the next pull. Deletion is
    -- `update ... set deleted_at = now()`, which the update grant already
    -- covers and which the touch trigger timestamps for the sync cursor.
    --
    -- REVOKE first: granting a narrower set doesn't take away a broader one, and
    -- some projects hand `authenticated` blanket privileges by default. Without
    -- this, "no delete grant" would be a comment rather than a fact.
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update on public.%I to authenticated', t);

    -- anon gets nothing: there is no public read path to user garden data.
  end loop;
end $$;
