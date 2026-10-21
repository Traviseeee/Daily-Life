-- MYLIFE QC B3: storage bucket "images" — owner-only access.
-- Before: anyone could LIST/READ every object through the API, and any signed-in
-- account could overwrite or delete any other account's image.
-- After: a signed-in user can read/list, upload, update and delete only inside
-- users/<their auth.uid()>/... The bucket stays PUBLIC, so every image link the app
-- already saved (/storage/v1/object/public/images/...) keeps working.
-- Run once in the Supabase SQL editor (one transaction). Rollback: see the end.

begin;

-- The old policies have different names in the repo and on the live project
-- (live, checked 2026-10-21: "Public can view images", "Authenticated users can
-- upload/update/delete images"). Policies add up (OR), so EVERY old one must go,
-- or the new rules change nothing. Drop each old image policy by name, any case.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and lower(policyname) in (
        'public can view images',
        'authenticated users can upload images',
        'authenticated users can update images',
        'authenticated users can delete images',
        'public read access to images',
        'authenticated users can update their own images',
        'authenticated users can delete their own images')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

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

-- Safety check: after this, storage.objects must have exactly the 4 new policies.
-- If any other policy is left (it could still open the bucket), stop and undo everything.
do $$
declare extra text;
begin
  select string_agg(policyname, ', ') into extra from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname not like 'images: owner %';
  if extra is not null then
    raise exception 'B3 stopped, nothing changed: other storage policies still exist: %', extra;
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') <> 4 then
    raise exception 'B3 stopped, nothing changed: expected 4 policies';
  end if;
end $$;

commit;

-- Rollback (only if the app breaks): run 20261021_images_owner_only_rollback.sql
