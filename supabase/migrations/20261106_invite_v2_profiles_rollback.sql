-- Undo 20261106_invite_v2_profiles.sql: removes ONLY what it added
-- (member profiles, link-use history, the v2 link columns). Families, members
-- and app_data are not touched. Links with no expiry get a 7-day expiry back.
begin;
drop function if exists public.family_profiles(uuid);
drop function if exists public.cancel_family_invite(text);
drop function if exists public.decide_family_join(text, uuid, boolean);
drop function if exists public.accept_family_invite_v2(text, text);
drop function if exists public.family_invite_preview_v2(text);
drop function if exists public.create_family_invite_v2(uuid, text, jsonb, int, int, text, text);
drop function if exists public.family_invite_status(public.family_invites);
drop function if exists public.family_invite_find(text);
drop table if exists public.member_profiles;
drop table if exists public.family_invite_uses;
update public.family_invites set expires_at = coalesce(cancelled_at, now()) + interval '7 days' where expires_at is null;
alter table public.family_invites alter column expires_at set not null;
alter table public.family_invites drop constraint if exists family_invites_v2_check;
drop index if exists public.family_invites_code_idx;
alter table public.family_invites drop column if exists cancelled_at, drop column if exists needs_approval,
  drop column if exists member_card_id, drop column if exists label, drop column if exists use_count,
  drop column if exists max_uses, drop column if exists code;
-- the original accept_family_invite from 20261023_family_core.sql
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
commit;
