-- MYLIFE Memories feed: PRIVATE storage bucket "family-media".
-- Photos/videos of memory posts live here, never in app_data.payload.
-- Only the signed-in owner can list, read, upload, update or delete files under
-- users/<their auth.uid()>/… The app shows files with short-lived signed URLs.
-- Adds a bucket + 4 policies only. Existing buckets ("images"), policies and data
-- are not touched. Run once in the Supabase SQL editor. Rollback: see the end.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-media', 'family-media', false, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

drop policy if exists "family-media: owner reads own folder" on storage.objects;
drop policy if exists "family-media: owner uploads to own folder" on storage.objects;
drop policy if exists "family-media: owner updates own files" on storage.objects;
drop policy if exists "family-media: owner deletes own files" on storage.objects;

create policy "family-media: owner reads own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "family-media: owner uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "family-media: owner updates own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "family-media: owner deletes own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- safety: the bucket must be private
do $$
begin
  if (select public from storage.buckets where id = 'family-media') then
    raise exception 'family-media must be a private bucket — nothing changed';
  end if;
end $$;

commit;

-- Rollback (only while the bucket is still empty):
--   drop policy "family-media: owner reads own folder" on storage.objects;
--   drop policy "family-media: owner uploads to own folder" on storage.objects;
--   drop policy "family-media: owner updates own files" on storage.objects;
--   drop policy "family-media: owner deletes own files" on storage.objects;
--   delete from storage.buckets where id = 'family-media';
