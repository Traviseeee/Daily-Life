-- MYLIFE Part 2B: shared family Memories (posts, ❤️, comments).
-- Adds 3 NEW tables + RLS + 4 functions + 1 storage READ policy.
-- Existing tables (app_data, families, family_members, family_invites), buckets,
-- files and data are not touched. Needs 20261023_family_core.sql first.
-- Run once in the Supabase SQL editor. Running it twice is safe.
-- Rollback: supabase/migrations/20261023_family_posts_rollback.sql
--
-- "Copy, not move": a personal memory stays in app_data.payload. Sharing it adds
-- a row here that points to the SAME files in the private "family-media" bucket
-- (no second copy of the photos). Family members get read access to exactly the
-- files listed in a post they are allowed to see — nothing else in the bucket.
--
-- Who can do what (permissions from family_members):
--   see posts / ❤️      : admin, or anyone whose permissions.memories = true
--   post / comment      : admin or member with memories = true (viewers can't)
--   edit a post         : its author
--   delete a post       : its author or an admin
--   delete a comment    : its writer, the post author or an admin

begin;

-- helpers ---------------------------------------------------------------
create or replace function public.family_can(p_family uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family and m.user_id = auth.uid()
      and (m.role = 'admin' or coalesce((m.permissions ->> p_perm)::boolean, false))
  )
$$;

create or replace function public.family_can_post(p_family uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family and m.user_id = auth.uid()
      and (m.role = 'admin' or (m.role = 'member' and coalesce((m.permissions ->> 'memories')::boolean, false)))
  )
$$;

-- tables ------------------------------------------------------------------
create table if not exists public.family_posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_id text check (char_length(source_id) <= 120),
  caption text not null default '' check (char_length(caption) <= 2200),
  place text not null default '' check (char_length(place) <= 120),
  taken_on date,
  tag_names text[] not null default '{}' check (cardinality(tag_names) <= 30),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  media_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, author_id, source_id)
);
create index if not exists family_posts_family_idx on public.family_posts (family_id, taken_on desc, created_at desc);
create index if not exists family_posts_paths_idx on public.family_posts using gin (media_paths);

create table if not exists public.family_post_likes (
  post_id uuid not null references public.family_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.family_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.family_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists family_post_comments_post_idx on public.family_post_comments (post_id, created_at);

alter table public.family_posts enable row level security;
alter table public.family_post_likes enable row level security;
alter table public.family_post_comments enable row level security;

-- a post's files must be the author's own: users/<author>/…; the list of
-- readable paths is always taken from media (path + thumb), never sent by the app
create or replace function public.family_posts_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_paths text[]; v_bad text;
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id or new.author_id <> old.author_id or new.source_id is distinct from old.source_id then
      raise exception 'family_id / author_id / source_id cannot change';
    end if;
  end if;
  select coalesce(array_agg(distinct p), '{}') into v_paths
  from jsonb_array_elements(new.media) as e,
       lateral unnest(array[e ->> 'path', e ->> 'thumb']) as p
  where p is not null and p <> '';
  select p into v_bad from unnest(v_paths) as p
  where p not like 'users/' || new.author_id::text || '/%' or p like '%..%' limit 1;
  if v_bad is not null then raise exception 'media must be in your own folder'; end if;
  new.media_paths := v_paths;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists family_posts_guard on public.family_posts;
create trigger family_posts_guard before insert or update on public.family_posts
  for each row execute function public.family_posts_guard();

-- is this post visible to me? (used by likes, comments and the storage policy)
create or replace function public.family_post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_posts p where p.id = p_post and public.family_can(p.family_id, 'memories'))
$$;

create or replace function public.family_media_visible(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_posts p
    where p.media_paths @> array[p_name] and public.family_can(p.family_id, 'memories')
  )
$$;

-- policies ----------------------------------------------------------------
drop policy if exists "family_posts: allowed members read" on public.family_posts;
drop policy if exists "family_posts: members post" on public.family_posts;
drop policy if exists "family_posts: author edits" on public.family_posts;
drop policy if exists "family_posts: author or admin deletes" on public.family_posts;
create policy "family_posts: allowed members read" on public.family_posts for select to authenticated
  using (public.family_can(family_id, 'memories'));
create policy "family_posts: members post" on public.family_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.family_can_post(family_id));
create policy "family_posts: author edits" on public.family_posts for update to authenticated
  using (author_id = (select auth.uid()) and public.family_can_post(family_id))
  with check (author_id = (select auth.uid()) and public.family_can_post(family_id));
create policy "family_posts: author or admin deletes" on public.family_posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_family_admin(family_id));

drop policy if exists "family_post_likes: read" on public.family_post_likes;
drop policy if exists "family_post_likes: like" on public.family_post_likes;
drop policy if exists "family_post_likes: unlike own" on public.family_post_likes;
create policy "family_post_likes: read" on public.family_post_likes for select to authenticated
  using (public.family_post_visible(post_id));
create policy "family_post_likes: like" on public.family_post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.family_post_visible(post_id));
create policy "family_post_likes: unlike own" on public.family_post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "family_post_comments: read" on public.family_post_comments;
drop policy if exists "family_post_comments: write" on public.family_post_comments;
drop policy if exists "family_post_comments: delete" on public.family_post_comments;
create policy "family_post_comments: read" on public.family_post_comments for select to authenticated
  using (public.family_post_visible(post_id));
create policy "family_post_comments: write" on public.family_post_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.family_posts p where p.id = post_id and public.family_can_post(p.family_id)));
create policy "family_post_comments: delete" on public.family_post_comments for delete to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.family_posts p where p.id = post_id
      and (p.author_id = (select auth.uid()) or public.is_family_admin(p.family_id))));

-- storage: family members may READ the files of posts they can see (read only;
-- upload/update/delete stay owner-only from 20261022_family_media_bucket.sql)
drop policy if exists "family-media: family reads shared posts" on storage.objects;
create policy "family-media: family reads shared posts"
  on storage.objects for select to authenticated
  using (bucket_id = 'family-media' and public.family_media_visible(name));

-- table rights
revoke all on public.family_posts, public.family_post_likes, public.family_post_comments from anon;
grant select, insert, update, delete on public.family_posts to authenticated;
grant select, insert, delete on public.family_post_likes to authenticated;
grant select, insert, delete on public.family_post_comments to authenticated;

revoke all on function public.family_can(uuid, text), public.family_can_post(uuid),
  public.family_post_visible(uuid), public.family_media_visible(text) from public, anon;
grant execute on function public.family_can(uuid, text), public.family_can_post(uuid),
  public.family_post_visible(uuid), public.family_media_visible(text) to authenticated;

commit;
