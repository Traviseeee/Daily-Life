-- ROLLBACK for 20261021_images_owner_only.sql (QC B3).
-- Run ONLY if images break after the migration. It puts back the 4 policies
-- exactly as they were on the live project on 2026-10-21 (from pg_policies).
begin;

drop policy if exists "images: owner reads own folder" on storage.objects;
drop policy if exists "images: owner uploads to own folder" on storage.objects;
drop policy if exists "images: owner updates own files" on storage.objects;
drop policy if exists "images: owner deletes own files" on storage.objects;

create policy "Authenticated users can upload images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'images'::text);

create policy "Public can view images"
  on storage.objects for select to public
  using (bucket_id = 'images'::text);

create policy "Authenticated users can update images"
  on storage.objects for update to authenticated
  using (bucket_id = 'images'::text)
  with check (bucket_id = 'images'::text);

create policy "Authenticated users can delete images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images'::text);

commit;
