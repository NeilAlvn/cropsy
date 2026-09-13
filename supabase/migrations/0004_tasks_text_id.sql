-- 0004 — tasks.id becomes text
--
-- Timeline nodes carry deterministic ids (`<plant>-transplant`, `<plant>-feed-2`,
-- `water-<plant>-<date>`) so a rebuilt path replaces itself and completions
-- survive regeneration. Those are not uuids; the uuid column rejected every
-- task push. No table references tasks.id, so the type change is contained.
alter table public.tasks alter column id drop default;
alter table public.tasks alter column id type text using id::text;
