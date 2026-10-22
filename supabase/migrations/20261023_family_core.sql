-- MYLIFE Part 2A: family group, members, invites.
-- Adds 3 NEW tables + RLS + 5 functions. Existing tables (app_data …), buckets
-- and data are not touched. Run once in the Supabase SQL editor.
-- Rollback: supabase/migrations/20261023_family_core_rollback.sql
--
-- Roles: admin (owner, invites/removes, sets permissions) · member (posts, ❤️,
-- comments) · viewer (looks and ❤️ only). permissions = what that member may see:
--   memories, calendar, shopping   → on by default
--   myEvents, money, bills, savings → off by default (money is view-only, used in 2D)
-- The money / AI key / PIN in app_data are never readable by other members:
-- nothing here gives access to app_data.

begin;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'គ្រួសារខ្ញុំ' check (char_length(name) between 1 and 60),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member', 'viewer')),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  display_name text check (char_length(display_name) <= 40),
  avatar text check (char_length(avatar) <= 16),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index if not exists family_members_user_idx on public.family_members (user_id);

create table if not exists public.family_invites (
  token text primary key check (char_length(token) >= 32),
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('member', 'viewer')),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
create index if not exists family_invites_family_idx on public.family_invites (family_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;

-- helpers (security definer so the policies don't call themselves)
create or replace function public.is_family_member(p_family uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m where m.family_id = p_family and m.user_id = auth.uid())
$$;

create or replace function public.is_family_admin(p_family uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m where m.family_id = p_family and m.user_id = auth.uid() and m.role = 'admin')
$$;

-- only the known switches, as true/false
create or replace function public.family_clean_permissions(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(coalesce((p ->> k)::boolean, false))), '{}'::jsonb)
  from unnest(array['memories', 'calendar', 'shopping', 'myEvents', 'money', 'bills', 'savings']) as k
  where p ? k
$$;

-- policies -------------------------------------------------------------
drop policy if exists "families: members read" on public.families;
drop policy if exists "families: admin renames" on public.families;
drop policy if exists "families: owner deletes" on public.families;
create policy "families: members read" on public.families for select to authenticated
  using (public.is_family_member(id));
create policy "families: admin renames" on public.families for update to authenticated
  using (public.is_family_admin(id)) with check (public.is_family_admin(id));
create policy "families: owner deletes" on public.families for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "family_members: members read" on public.family_members;
drop policy if exists "family_members: admin or self updates" on public.family_members;
drop policy if exists "family_members: admin removes or self leaves" on public.family_members;
create policy "family_members: members read" on public.family_members for select to authenticated
  using (public.is_family_member(family_id));
create policy "family_members: admin or self updates" on public.family_members for update to authenticated
  using (public.is_family_admin(family_id) or user_id = (select auth.uid()))
  with check (public.is_family_admin(family_id) or user_id = (select auth.uid()));
create policy "family_members: admin removes or self leaves" on public.family_members for delete to authenticated
  using (public.is_family_admin(family_id) or user_id = (select auth.uid()));

drop policy if exists "family_invites: admin reads" on public.family_invites;
drop policy if exists "family_invites: admin cancels" on public.family_invites;
create policy "family_invites: admin reads" on public.family_invites for select to authenticated
  using (public.is_family_admin(family_id));
create policy "family_invites: admin cancels" on public.family_invites for delete to authenticated
  using (public.is_family_admin(family_id));

-- guard rows: nobody moves a row to another family/user; only admins change
-- role/permissions; the owner always stays admin and can't be removed
create or replace function public.family_members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select f.owner_id into v_owner from public.families f where f.id = old.family_id;
  if tg_op = 'DELETE' then
    if v_owner is not null and old.user_id = v_owner then
      raise exception 'the family owner cannot be removed';
    end if;
    return old;
  end if;
  if new.family_id <> old.family_id or new.user_id <> old.user_id then
    raise exception 'family_id / user_id cannot change';
  end if;
  if (new.role <> old.role or new.permissions <> old.permissions) and not public.is_family_admin(old.family_id) then
    raise exception 'only an admin can change role or permissions';
  end if;
  if old.user_id = v_owner and new.role <> 'admin' then
    raise exception 'the family owner stays admin';
  end if;
  new.permissions := public.family_clean_permissions(new.permissions);
  return new;
end $$;
drop trigger if exists family_members_guard on public.family_members;
create trigger family_members_guard before update or delete on public.family_members
  for each row execute function public.family_members_guard();

-- table rights: rows are only added through the functions below
revoke all on public.families, public.family_members, public.family_invites from anon;
revoke insert on public.families, public.family_members, public.family_invites from authenticated;
grant select, update, delete on public.families to authenticated;
grant select, update, delete on public.family_members to authenticated;
grant select, delete on public.family_invites to authenticated;

-- functions ------------------------------------------------------------
-- my family (creates it the first time; I become admin)
create or replace function public.create_family(p_name text default null, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'sign in first'; end if;
  select id into v_id from public.families where owner_id = v_uid;
  if v_id is not null then return v_id; end if;
  insert into public.families (name, owner_id)
    values (coalesce(nullif(trim(p_name), ''), 'គ្រួសារខ្ញុំ'), v_uid) returning id into v_id;
  insert into public.family_members (family_id, user_id, role, permissions, display_name)
    values (v_id, v_uid, 'admin',
      '{"memories":true,"calendar":true,"shopping":true,"myEvents":true,"money":true,"bills":true,"savings":true}'::jsonb,
      nullif(trim(p_display_name), ''));
  return v_id;
end $$;

-- admin: a single-use link, 7 days
create or replace function public.create_family_invite(p_family uuid, p_role text, p_permissions jsonb default '{}'::jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.is_family_admin(p_family) then raise exception 'only an admin can invite'; end if;
  if p_role not in ('member', 'viewer') then raise exception 'role must be member or viewer'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.family_invites (token, family_id, role, permissions, created_by)
    values (v_token, p_family, p_role, public.family_clean_permissions(coalesce(p_permissions, '{}'::jsonb)), auth.uid());
  return v_token;
end $$;

-- before joining: which family, which role, still valid?
create or replace function public.family_invite_preview(p_token text)
returns table (family_name text, role text, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select f.name, i.role, i.expires_at,
    case when i.used_by is not null then 'used' when i.expires_at < now() then 'expired' else 'ok' end
  from public.family_invites i join public.families f on f.id = i.family_id
  where i.token = p_token
$$;

-- join with the link (once); already a member → just returns the family
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
  if v_inv.used_by is not null then raise exception 'invite already used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.family_members (family_id, user_id, role, permissions, display_name)
    values (v_inv.family_id, v_uid, v_inv.role, v_inv.permissions, nullif(trim(p_display_name), ''));
  update public.family_invites set used_by = v_uid, used_at = now() where token = p_token;
  return v_inv.family_id;
end $$;

revoke all on function public.create_family(text, text), public.create_family_invite(uuid, text, jsonb),
  public.family_invite_preview(text), public.accept_family_invite(text, text),
  public.is_family_member(uuid), public.is_family_admin(uuid) from public, anon;
grant execute on function public.create_family(text, text), public.create_family_invite(uuid, text, jsonb),
  public.family_invite_preview(text), public.accept_family_invite(text, text),
  public.is_family_member(uuid), public.is_family_admin(uuid) to authenticated;

commit;
