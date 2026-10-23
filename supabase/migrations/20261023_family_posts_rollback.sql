-- Undo 20261023_family_posts.sql: removes shared family posts, ❤️ and comments
-- and the "family reads shared posts" storage policy. Personal memories in
-- app_data and the photo/video files in "family-media" are NOT touched.
begin;
drop policy if exists "family-media: family reads shared posts" on storage.objects;
drop table if exists public.family_post_comments;
drop table if exists public.family_post_likes;
drop table if exists public.family_posts;
drop function if exists public.family_posts_guard();
drop function if exists public.family_media_visible(text);
drop function if exists public.family_post_visible(uuid);
drop function if exists public.family_can_post(uuid);
drop function if exists public.family_can(uuid, text);
commit;
