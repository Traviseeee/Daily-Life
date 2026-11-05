-- Removes only what 20261105_nimo_core.sql added (Nimo XP tables + functions).
begin;
drop function if exists public.nimo_award(text);
drop function if exists public.nimo_state();
drop function if exists public.nimo_finance(uuid);
drop function if exists public.nimo_month_streak(uuid);
drop function if exists public.nimo_seen(integer);
drop function if exists public.nimo_level_for(integer);
drop function if exists public.nimo_xp_for_level(integer);
drop table if exists public.nimo_xp_history;
drop table if exists public.nimo_profile;
commit;
