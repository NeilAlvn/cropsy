-- 0001 — syncable foundation
--
-- Establishes the delta-sync conventions from docs/API-CONTRACT.md §6 before any
-- feature tables exist: every user-owned table gets id + owner + updated_at +
-- deleted_at, an auto-touch trigger, and owner-scoped RLS. This is the seam that
-- makes the Flutter client offline-first and delta-syncing.
--
-- Apply with the Supabase CLI / execute_sql once the project exists. Not yet run.

-- Server-maintained updated_at, so the client can never spoof a sync cursor.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── gardens ────────────────────────────────────────────────────────────────
create table if not exists gardens (
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
  deleted_at  timestamptz
);

-- ── garden_plants (a crop the user is growing, in a garden) ─────────────────
create table if not exists garden_plants (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users (id) on delete cascade,
  garden_id    uuid not null references gardens (id) on delete cascade,
  crop_slug    text not null,          -- refers to bundled crop reference data
  pot_litres   int,                    -- null = in-ground
  planted_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ── tasks (this-week items; kind enum still being finalized) ────────────────
create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references auth.users (id) on delete cascade,
  garden_plant_id uuid references garden_plants (id) on delete cascade,
  kind           text not null,        -- water | sow | transplant | harvest | feed
  due            date not null,
  completed_at   timestamptz,          -- back-datable (F4)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- ── journal_entries (F5 photo journal) ──────────────────────────────────────
create table if not exists journal_entries (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references auth.users (id) on delete cascade,
  garden_plant_id uuid references garden_plants (id) on delete cascade,
  entry_on       date not null,        -- back-datable
  note           text,
  photo_path     text,                 -- storage key; compressed client-side
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- ── triggers + indexes + RLS for every syncable table ───────────────────────
do $$
declare t text;
begin
  foreach t in array array['gardens', 'garden_plants', 'tasks', 'journal_entries']
  loop
    execute format(
      'create trigger %I_touch before update on %I
         for each row execute function set_updated_at()', t, t);

    -- Delta-pull index: owner + updated_at is the hot path (API §6).
    execute format(
      'create index if not exists %I_owner_updated on %I (owner, updated_at)', t, t);

    execute format('alter table %I enable row level security', t);

    -- One policy: a user reads/writes only their own rows (TO authenticated +
    -- ownership predicate — authentication AND authorization, per Supabase rules).
    execute format(
      'create policy %I_owner_all on %I
         for all to authenticated
         using (owner = (select auth.uid()))
         with check (owner = (select auth.uid()))', t, t);
  end loop;
end $$;
