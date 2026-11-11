-- Removes only what 20261111_family_couples.sql added.
begin;
drop function if exists public.family_couple_set(uuid, uuid, date);
drop table if exists public.family_couples;
commit;
