-- MYLIFE QC B3: storage bucket "images" — owner-only access.
-- Before: anyone could LIST/READ every object through the API, and any signed-in
-- account could overwrite or delete any other account's image.
-- After: a signed-in user can read/list, upload, update and delete only inside
-- users/<their auth.uid()>/... The bucket stays PUBLIC, so every image link the app
-- already saved (/storage/v1/object/public/images/...) keeps working.
-- Run once in the Supabase SQL editor (one transaction). Rollback: see the end.

begin;

drop policy if exists "Public read access to images" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Authenticated users can update their own images" on storage.objects;
drop policy if exists "Authenticated users can delete their own images" on storage.objects;

drop policy if exists "images: owner reads own folder" on storage.objects;
drop policy if exists "images: owner uploads to own folder" on storage.objects;
drop policy if exists "images: owner updates own files" on storage.objects;
drop policy if exists "images: owner deletes own files" on storage.objects;

create policy "images: owner reads own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "images: owner uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "images: owner updates own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "images: owner deletes own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

commit;

-- Rollback (only if the app breaks): drop the 4 policies above, then re-create
-- the 4 previous policies exactly as they were in supabase/schema.sql before
-- commit "Storage owner-only (QC B3)".
