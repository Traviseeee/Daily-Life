-- MYLIFE · invite links v2 + member profiles (6 Nov 2026)
-- ADD ONLY: new columns on family_invites, 2 new tables, new functions.
-- Existing rows (families, family_members, family_invites, app_data) are not
-- changed or deleted. Old links and the old functions keep working.
-- Run after 20261023_family_core.sql. Safe to run twice.
begin;

-- 1. invite links v2 ------------------------------------------------------
--    expiry: 1 / 7 / 30 days or none · uses: 1..50 · a short code (6 chars)
--    · optional family card it is for · admin approval for long/multi links
alter table public.family_invites add column if not exists code text;
alter table public.family_invites add column if not exists max_uses int not null default 1;
alter table public.family_invites add column if not exists use_count int not null default 0;
alter table public.family_invites add column if not exists label text;
alter table public.family_invites add column if not exists member_card_id text;
alter table public.family_invites add column if not exists needs_approval boolean not null default false;
alter table public.family_invites add column if not exists cancelled_at timestamptz;
alter table public.family_invites alter column expires_at drop not null; -- null = never expires (the default stays 7 days)
do $$ begin
  alter table public.family_invites add constraint family_invites_v2_check check (
    max_uses between 1 and 50 and use_count >= 0
    and (code is null or code ~ '^[A-Z2-9]{6}$')
    and (label is null or char_length(label) <= 40)
    and (member_card_id is null or char_length(member_card_id) <= 80));
exception when duplicate_object then null; end $$;
create unique index if not exists family_invites_code_idx on public.family_invites (code) where code is not null;

-- who used which link (joined, or waiting for the admin)
create table if not exists public.family_invite_uses (
  token text not null references public.family_invites (token) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'joined' check (status in ('pending', 'joined', 'rejected')),
  display_name text check (char_length(display_name) <= 40),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (token, user_id)
);
create index if not exists family_invite_uses_user_idx on public.family_invite_uses (user_id);
alter table public.family_invite_uses enable row level security;
drop policy if exists "family_invite_uses: admin or self reads" on public.family_invite_uses;
create policy "family_invite_uses: admin or self reads" on public.family_invite_uses for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.family_invites i where i.token = family_invite_uses.token and public.is_family_admin(i.family_id)));
-- no insert / update / delete policies: only the functions below write here

-- 2. member profiles ("like Facebook") ------------------------------------
--    photos are small data:image URLs (resized on the phone) — no new bucket
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  photo text check (photo is null or (char_length(photo) <= 160000 and photo like 'data:image/%')),
  cover text check (cover is null or (char_length(cover) <= 260000 and cover like 'data:image/%')),
  bio text check (char_length(bio) <= 160),
  birthday date,
  relation text check (char_length(relation) <= 30),
  phone text check (char_length(phone) <= 30),
  telegram text check (char_length(telegram) <= 40),
  hidden jsonb not null default '{}'::jsonb check (jsonb_typeof(hidden) = 'object'), -- {"phone": true} = only me
  updated_at timestamptz not null default now()
);
alter table public.member_profiles enable row level security;
drop policy if exists "member_profiles: owner reads" on public.member_profiles;
drop policy if exists "member_profiles: owner inserts" on public.member_profiles;
drop policy if exists "member_profiles: owner updates" on public.member_profiles;
create policy "member_profiles: owner reads" on public.member_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "member_profiles: owner inserts" on public.member_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "member_profiles: owner updates" on public.member_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- family members read each other only through family_profiles() (hidden fields removed)

-- 3. functions ------------------------------------------------------------
create or replace function public.family_invite_find(p_key text)
returns public.family_invites language sql stable security definer set search_path = '' as $$
  select * from public.family_invites
  where token = p_key or (char_length(p_key) = 6 and code = upper(p_key))
  limit 1
$$;

create or replace function public.family_invite_status(i public.family_invites)
returns text language sql stable set search_path = '' as $$
  select case
    when i.cancelled_at is not null then 'cancelled'
    when i.expires_at is not null and i.expires_at < now() then 'expired'
    when i.used_by is not null and i.max_uses <= 1 then 'used'
    when i.use_count >= i.max_uses then 'used'
    else 'ok' end
$$;

-- admin: make a link (returns token + 6-char code)
create or replace function public.create_family_invite_v2(
  p_family uuid, p_role text, p_permissions jsonb default '{}'::jsonb,
  p_days int default 7, p_max_uses int default 1, p_label text default null, p_card_id text default null)
returns table (token text, code text) language plpgsql security definer set search_path = '' as $$
declare v_token text; v_code text; v_abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v_try int := 0;
begin
  if not public.is_family_admin(p_family) then raise exception 'only an admin can invite'; end if;
  if p_role not in ('member', 'viewer') then raise exception 'role must be member or viewer'; end if;
  if p_days is not null and (p_days < 1 or p_days > 365) then raise exception 'days must be 1..365 or null'; end if;
  if coalesce(p_max_uses, 1) < 1 or coalesce(p_max_uses, 1) > 50 then raise exception 'uses must be 1..50'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_abc, 1 + floor(random() * length(v_abc))::int, 1); end loop;
    exit when not exists (select 1 from public.family_invites f where f.code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'could not make a code, try again'; end if;
  end loop;
  insert into public.family_invites (token, family_id, role, permissions, created_by, expires_at, code, max_uses, label, member_card_id, needs_approval)
  values (v_token, p_family, p_role, public.family_clean_permissions(coalesce(p_permissions, '{}'::jsonb)), auth.uid(),
    case when p_days is null then null else now() + make_interval(days => p_days) end,
    v_code, coalesce(p_max_uses, 1), nullif(trim(p_label), ''), nullif(trim(p_card_id), ''),
    p_days is null or coalesce(p_max_uses, 1) > 1);
  return query select v_token, v_code;
end $$;

-- before joining (link or code): which family, who invited, still valid?
create or replace function public.family_invite_preview_v2(p_key text)
returns table (token text, family_name text, role text, expires_at timestamptz, status text,
  needs_approval boolean, inviter text, member_count int, my_status text)
language plpgsql stable security definer set search_path = '' as $$
declare i public.family_invites;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  i := public.family_invite_find(p_key);
  if i.token is null then return; end if;
  return query select i.token, f.name, i.role, i.expires_at, public.family_invite_status(i), i.needs_approval,
    (select coalesce(p.display_name, m.display_name) from public.family_members m
       left join public.member_profiles p on p.user_id = m.user_id
       where m.family_id = i.family_id and m.user_id = coalesce(i.created_by, f.owner_id)),
    (select count(*)::int from public.family_members m where m.family_id = i.family_id),
    case when exists (select 1 from public.family_members m where m.family_id = i.family_id and m.user_id = auth.uid()) then 'member'
      else (select u.status from public.family_invite_uses u where u.token = i.token and u.user_id = auth.uid()) end
  from public.families f where f.id = i.family_id;
end $$;

-- join: straight in, or a request the admin approves
create or replace function public.accept_family_invite_v2(p_key text, p_display_name text default null)
returns table (family_id uuid, status text) language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); i public.family_invites; v_use text; v_name text := nullif(trim(p_display_name), '');
begin
  if v_uid is null then raise exception 'sign in first'; end if;
  i := public.family_invite_find(p_key);
  if i.token is null then raise exception 'invite not found'; end if;
  perform 1 from public.family_invites x where x.token = i.token for update;
  select * into i from public.family_invites x where x.token = i.token;
  if exists (select 1 from public.family_members m where m.family_id = i.family_id and m.user_id = v_uid) then
    return query select i.family_id, 'joined'::text; return;
  end if;
  select u.status into v_use from public.family_invite_uses u where u.token = i.token and u.user_id = v_uid;
  if v_use = 'pending' then return query select i.family_id, 'pending'::text; return; end if;
  if v_use = 'rejected' then raise exception 'request declined'; end if;
  if public.family_invite_status(i) <> 'ok' then raise exception 'invite %', public.family_invite_status(i); end if;
  if i.needs_approval then
    insert into public.family_invite_uses (token, user_id, status, display_name) values (i.token, v_uid, 'pending', v_name);
    return query select i.family_id, 'pending'::text; return;
  end if;
  insert into public.family_members (family_id, user_id, role, permissions, display_name)
    values (i.family_id, v_uid, i.role, i.permissions, v_name);
  insert into public.family_invite_uses (token, user_id, status, display_name, decided_at) values (i.token, v_uid, 'joined', v_name, now());
  update public.family_invites x set use_count = x.use_count + 1,
    used_by = case when x.max_uses <= 1 then v_uid else x.used_by end,
    used_at = case when x.max_uses <= 1 then now() else x.used_at end
  where x.token = i.token;
  return query select i.family_id, 'joined'::text;
end $$;

-- admin: approve or decline a request
create or replace function public.decide_family_join(p_token text, p_user uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare i public.family_invites; u public.family_invite_uses;
begin
  select * into i from public.family_invites x where x.token = p_token for update;
  if not found or not public.is_family_admin(i.family_id) then raise exception 'only an admin can decide'; end if;
  select * into u from public.family_invite_uses x where x.token = p_token and x.user_id = p_user;
  if not found or u.status <> 'pending' then raise exception 'no waiting request'; end if;
  if not p_approve then
    update public.family_invite_uses x set status = 'rejected', decided_at = now() where x.token = p_token and x.user_id = p_user;
    return 'rejected';
  end if;
  if i.cancelled_at is not null or i.use_count >= i.max_uses then raise exception 'link is cancelled or full'; end if;
  insert into public.family_members (family_id, user_id, role, permissions, display_name)
    values (i.family_id, p_user, i.role, i.permissions, u.display_name)
    on conflict on constraint family_members_pkey do nothing;
  update public.family_invite_uses x set status = 'joined', decided_at = now() where x.token = p_token and x.user_id = p_user;
  update public.family_invites x set use_count = x.use_count + 1 where x.token = p_token;
  return 'joined';
end $$;

-- admin: stop a link (kept for history, never deleted)
create or replace function public.cancel_family_invite(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_family uuid;
begin
  select x.family_id into v_family from public.family_invites x where x.token = p_token;
  if v_family is null or not public.is_family_admin(v_family) then raise exception 'only an admin can cancel'; end if;
  update public.family_invites x set cancelled_at = now() where x.token = p_token and x.cancelled_at is null;
end $$;

-- everyone's profile in my family (fields they hid are left out, except for me)
create or replace function public.family_profiles(p_family uuid)
returns table (user_id uuid, role text, joined_at timestamptz, display_name text, photo text, cover text, bio text,
  birthday date, relation text, phone text, telegram text, hidden jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, m.joined_at, coalesce(p.display_name, m.display_name), p.photo, p.cover,
    case when m.user_id = auth.uid() or not coalesce((p.hidden ->> 'bio')::boolean, false) then p.bio end,
    case when m.user_id = auth.uid() or not coalesce((p.hidden ->> 'birthday')::boolean, false) then p.birthday end,
    case when m.user_id = auth.uid() or not coalesce((p.hidden ->> 'relation')::boolean, false) then p.relation end,
    case when m.user_id = auth.uid() or not coalesce((p.hidden ->> 'phone')::boolean, false) then p.phone end,
    case when m.user_id = auth.uid() or not coalesce((p.hidden ->> 'telegram')::boolean, false) then p.telegram end,
    case when m.user_id = auth.uid() then coalesce(p.hidden, '{}'::jsonb) else '{}'::jsonb end,
    p.updated_at
  from public.family_members m left join public.member_profiles p on p.user_id = m.user_id
  where m.family_id = p_family and public.is_family_member(p_family)
$$;

-- the old join refuses v2 links that need approval or have many uses (old app versions)
create or replace function public.accept_family_invite(p_token text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_inv public.family_invites%rowtype;
begin
  if v_uid is null then raise exception 'sign in first'; end if;
  select * into v_inv from public.family_invites where token = p_token for update;
  if not found then raise exception 'invite not found'; end if;
  if exists (select 1 from public.family_members where family_id = v_inv.family_id and user_id = v_uid) then
    return v_inv.family_id;
  end if;
  if v_inv.needs_approval or v_inv.max_uses > 1 or v_inv.cancelled_at is not null then raise exception 'please update the app to use this link'; end if;
  if v_inv.used_by is not null then raise exception 'invite already used'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.family_members (family_id, user_id, role, permissions, display_name)
    values (v_inv.family_id, v_uid, v_inv.role, v_inv.permissions, nullif(trim(p_display_name), ''));
  update public.family_invites set used_by = v_uid, used_at = now(), use_count = use_count + 1 where token = p_token;
  return v_inv.family_id;
end $$;

revoke all on function public.family_invite_find(text), public.family_invite_status(public.family_invites),
  public.create_family_invite_v2(uuid, text, jsonb, int, int, text, text), public.family_invite_preview_v2(text),
  public.accept_family_invite_v2(text, text), public.decide_family_join(text, uuid, boolean),
  public.cancel_family_invite(text), public.family_profiles(uuid) from public, anon;
revoke all on function public.family_invite_find(text) from authenticated;
grant execute on function public.create_family_invite_v2(uuid, text, jsonb, int, int, text, text), public.family_invite_preview_v2(text),
  public.accept_family_invite_v2(text, text), public.decide_family_join(text, uuid, boolean),
  public.cancel_family_invite(text), public.family_profiles(uuid), public.family_invite_status(public.family_invites) to authenticated;
grant select, insert, update on public.member_profiles to authenticated;
grant select on public.family_invite_uses to authenticated;

commit;
