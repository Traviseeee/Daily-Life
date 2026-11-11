-- Rollback for 20261111_joint_deposits.sql. Removes only the deposit notes;
-- the savings accounts themselves (in each person's own data) stay.
begin;
drop function if exists public.family_joint_deposit(uuid, uuid, text, text, numeric, boolean);
drop function if exists public.family_joint_applied(uuid[]);
drop table if exists public.family_joint_actions;
commit;
