-- MYLIFE Family Chat: one group chat per family + private 2-person chats.
-- Adds 3 NEW tables + RLS + 7 functions, and (if it exists) adds family_messages
-- to the "supabase_realtime" publication so new messages arrive instantly.
-- Existing tables (app_data, families, family_members, …) and data are not touched.
-- Needs 20261023_family_core.sql first. Run once in the Supabase SQL editor;
-- running it twice is safe. Rollback: 20261106_family_chat_rollback.sql
--
-- Who can do what:
--   group chat : every member of the family reads + writes
--   2-person   : ONLY those two people (an admin cannot read it), and both must
--                still be in the family
--   delete msg : its writer; in the group chat also an admin (soft delete: text cleared)
-- All writes go through the functions below (no direct insert/update on the tables).

begin;

create table if not exists public.family_chats (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('group', 'dm')),
  user_a uuid references auth.users (id) on delete cascade,
  user_b uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint family_chats_shape check (
    (kind = 'group' and user_a is null and user_b is null) or
    (kind = 'dm' and user_a is not null and user_b is not null and user_a < user_b))
);
create unique index if not exists family_chats_group_uq on public.family_chats (family_id) where kind = 'group';
create unique index if not exists family_chats_dm_uq on public.family_chats (family_id, user_a, user_b) where kind = 'dm';

create table if not exists public.family_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.family_chats (id) on delete cascade,
  sender uuid references auth.users (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'sticker', 'share')),
  body text check (char_length(body) <= 1000),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 4000),
  reactions jsonb not null default '{}'::jsonb check (jsonb_typeof(reactions) = 'object'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists family_messages_chat_idx on public.family_messages (chat_id, created_at desc);

create table if not exists public.family_chat_reads (
  chat_id uuid not null references public.family_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

alter table public.family_chats enable row level security;
alter table public.family_messages enable row level security;
alter table public.family_chat_reads enable row level security;

-- can the signed-in user use this chat?
create or replace function public.family_chat_can(p_chat uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_chats c
    join public.family_members m on m.family_id = c.family_id and m.user_id = auth.uid()
    where c.id = p_chat
      and (c.kind = 'group' or auth.uid() in (c.user_a, c.user_b))
      and (c.kind = 'group' or exists (select 1 from public.family_members o where o.family_id = c.family_id
                                       and o.user_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end))
  )
$$;

drop policy if exists "family_chats: people in it read" on public.family_chats;
create policy "family_chats: people in it read" on public.family_chats for select to authenticated
  using (public.family_chat_can(id));
drop policy if exists "family_messages: people in the chat read" on public.family_messages;
create policy "family_messages: people in the chat read" on public.family_messages for select to authenticated
  using (public.family_chat_can(chat_id));
drop policy if exists "family_chat_reads: own" on public.family_chat_reads;
create policy "family_chat_reads: own" on public.family_chat_reads for select to authenticated
  using (user_id = auth.uid());

-- list my chats (makes the family group chat on first use) + last message + unread count
create or replace function public.family_chat_list(p_family uuid)
returns table (chat_id uuid, kind text, other_user uuid, last_body text, last_kind text, last_sender uuid, last_at timestamptz, unread int)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_family_member(p_family) then raise exception 'not a member'; end if;
  insert into public.family_chats (family_id, kind) values (p_family, 'group') on conflict do nothing;
  return query
  select c.id, c.kind,
         case when c.kind = 'dm' then (case when c.user_a = v_uid then c.user_b else c.user_a end) end,
         lm.body, lm.kind, lm.sender, coalesce(lm.created_at, c.created_at),
         (select count(*)::int from public.family_messages x
           where x.chat_id = c.id and x.deleted_at is null and x.sender is distinct from v_uid
             and x.created_at > coalesce((select r.last_read_at from public.family_chat_reads r where r.chat_id = c.id and r.user_id = v_uid), '-infinity'))
  from public.family_chats c
  left join lateral (select m.body, m.kind, m.sender, m.created_at from public.family_messages m
                     where m.chat_id = c.id and m.deleted_at is null order by m.created_at desc limit 1) lm on true
  where c.family_id = p_family and public.family_chat_can(c.id)
  order by (c.kind = 'group') desc, coalesce(lm.created_at, c.created_at) desc;
end $$;

-- open (or make) the private chat with one other member
create or replace function public.family_chat_open_dm(p_family uuid, p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_a uuid; v_b uuid; v_id uuid;
begin
  if v_uid is null or not public.is_family_member(p_family) then raise exception 'not a member'; end if;
  if p_other is null or p_other = v_uid then raise exception 'choose another member'; end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = p_other) then raise exception 'not in this family'; end if;
  v_a := least(v_uid, p_other); v_b := greatest(v_uid, p_other);
  insert into public.family_chats (family_id, kind, user_a, user_b) values (p_family, 'dm', v_a, v_b) on conflict do nothing;
  select id into v_id from public.family_chats where family_id = p_family and kind = 'dm' and user_a = v_a and user_b = v_b;
  return v_id;
end $$;

-- send: text (1–1000 chars) · sticker (data.sticker) · share card (data from the app, ≤4 KB)
create or replace function public.family_chat_send(p_chat uuid, p_kind text, p_body text default null, p_data jsonb default '{}'::jsonb)
returns public.family_messages language plpgsql security definer set search_path = '' as $$
declare v_row public.family_messages; v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if auth.uid() is null or not public.family_chat_can(p_chat) then raise exception 'not in this chat'; end if;
  if p_kind not in ('text', 'sticker', 'share') then raise exception 'bad kind'; end if;
  if p_kind = 'text' and v_body is null then raise exception 'empty message'; end if;
  if char_length(coalesce(v_body, '')) > 1000 then raise exception 'message too long'; end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object' then raise exception 'bad data'; end if;
  insert into public.family_messages (chat_id, sender, kind, body, data)
    values (p_chat, auth.uid(), p_kind, v_body, coalesce(p_data, '{}'::jsonb)) returning * into v_row;
  insert into public.family_chat_reads (chat_id, user_id, last_read_at) values (p_chat, auth.uid(), now())
    on conflict (chat_id, user_id) do update set last_read_at = excluded.last_read_at;
  return v_row;
end $$;

-- ❤️ 😂 👍 🎉 😢 🙏 — tap again to take it back
create or replace function public.family_chat_react(p_message uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat uuid; v_r jsonb; v_list jsonb; v_me text := auth.uid()::text;
begin
  if p_emoji not in ('❤️', '😂', '👍', '🎉', '😢', '🙏') then raise exception 'bad emoji'; end if;
  select chat_id, reactions into v_chat, v_r from public.family_messages where id = p_message and deleted_at is null for update;
  if v_chat is null or not public.family_chat_can(v_chat) then raise exception 'not in this chat'; end if;
  v_list := coalesce(v_r -> p_emoji, '[]'::jsonb);
  if v_list ? v_me then v_list := v_list - v_me; else v_list := v_list || to_jsonb(v_me); end if;
  v_r := case when jsonb_array_length(v_list) = 0 then v_r - p_emoji else jsonb_set(v_r, array[p_emoji], v_list) end;
  update public.family_messages set reactions = v_r where id = p_message;
  return v_r;
end $$;

-- delete (soft): writer, or an admin in the group chat
create or replace function public.family_chat_delete(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_msg public.family_messages; v_chat public.family_chats;
begin
  select * into v_msg from public.family_messages where id = p_message;
  if not found then raise exception 'not found'; end if;
  select * into v_chat from public.family_chats where id = v_msg.chat_id;
  if not public.family_chat_can(v_chat.id) then raise exception 'not in this chat'; end if;
  if v_msg.sender is distinct from auth.uid() and not (v_chat.kind = 'group' and public.is_family_admin(v_chat.family_id)) then
    raise exception 'only the writer (or an admin in the group) can delete';
  end if;
  update public.family_messages set deleted_at = now(), body = null, data = '{}'::jsonb, reactions = '{}'::jsonb where id = p_message;
end $$;

-- I have read this chat up to now
create or replace function public.family_chat_read(p_chat uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.family_chat_can(p_chat) then raise exception 'not in this chat'; end if;
  insert into public.family_chat_reads (chat_id, user_id, last_read_at) values (p_chat, auth.uid(), now())
    on conflict (chat_id, user_id) do update set last_read_at = excluded.last_read_at;
end $$;

-- grants: read through RLS, write only through the functions
revoke all on public.family_chats, public.family_messages, public.family_chat_reads from anon, authenticated;
grant select on public.family_chats, public.family_messages, public.family_chat_reads to authenticated;
revoke all on function public.family_chat_can(uuid), public.family_chat_list(uuid), public.family_chat_open_dm(uuid, uuid),
  public.family_chat_send(uuid, text, text, jsonb), public.family_chat_react(uuid, text), public.family_chat_delete(uuid),
  public.family_chat_read(uuid) from public, anon;
grant execute on function public.family_chat_can(uuid), public.family_chat_list(uuid), public.family_chat_open_dm(uuid, uuid),
  public.family_chat_send(uuid, text, text, jsonb), public.family_chat_react(uuid, text), public.family_chat_delete(uuid),
  public.family_chat_read(uuid) to authenticated;

-- instant delivery (Supabase Realtime still checks the read policy above)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_messages') then
    alter publication supabase_realtime add table public.family_messages;
  end if;
end $$;

commit;
