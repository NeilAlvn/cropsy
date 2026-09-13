-- 0003 — journal photo bucket (PRD 5.5 / Phase 2)
--
-- Private bucket; objects live under <owner uuid>/<file>. Policies scope every
-- operation to the first path segment = auth.uid(). The client compresses
-- before upload; the 5 MB cap is a backstop. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists journal_owner_select on storage.objects;
create policy journal_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists journal_owner_insert on storage.objects;
create policy journal_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists journal_owner_update on storage.objects;
create policy journal_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Photos are the one thing that may be hard-deleted: the journal row keeps
-- the path list, and a removed photo has no sync tombstone to carry.
drop policy if exists journal_owner_delete on storage.objects;
create policy journal_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);
