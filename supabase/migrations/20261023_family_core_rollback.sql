-- Undo 20261023_family_core.sql: removes ONLY the family tables + functions it added
-- (and the family groups / invites saved in them). app_data and storage are not touched.
begin;
drop function if exists public.accept_family_invite(text, text);
drop function if exists public.family_invite_preview(text);
drop function if exists public.create_family_invite(uuid, text, jsonb);
drop function if exists public.create_family(text, text);
drop table if exists public.family_invites;
drop table if exists public.family_members;
drop table if exists public.families;
drop function if exists public.family_members_guard();
drop function if exists public.family_clean_permissions(jsonb);
drop function if exists public.is_family_admin(uuid);
drop function if exists public.is_family_member(uuid);
commit;
