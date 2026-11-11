-- Removes only what 20261111_nimo_duo.sql added. XP already given stays in nimo_xp_history.
begin;
drop function if exists public.nimo_duo_refresh();
drop function if exists public.nimo_duo_leave(uuid);
drop function if exists public.nimo_duo_answer(uuid, boolean);
drop function if exists public.nimo_duo_invite(uuid, uuid);
drop table if exists public.nimo_duos;
commit;
