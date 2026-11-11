-- Rollback for 20261111_family_shares.sql. Removes only the shared COPIES;
-- every person's own data (app_state) and the family tables stay.
begin;
drop function if exists public.family_share_put(uuid, text, jsonb);
drop table if exists public.family_shares;
commit;
