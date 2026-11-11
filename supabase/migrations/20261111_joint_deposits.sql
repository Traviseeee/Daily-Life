-- MYLIFE · the partner on a joint savings account marks her own deposit (11 Nov 2026).
-- Adds 1 NEW table + RLS + 2 functions. Nothing existing is changed or deleted.
-- Run once in the Supabase SQL editor (safe to re-run).
-- Rollback: supabase/migrations/20261111_joint_deposits_rollback.sql
--
-- The account itself stays in the admin's own data (one place, one truth). The partner
-- leaves a small note here: "I put <amount> into account <id> for <month>" (or "undo").
-- The admin's app reads the notes, writes them into the account, and marks them applied.
-- She can only leave a note for an account that is shared with her as joint
-- (family_shares row 'joint:<her id>' holding that account id).

begin;

create table if not exists public.family_joint_actions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid not null references auth.users (id) on delete cascade,
  saving_id text not null check (char_length(saving_id) between 1 and 120),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric not null check (amount >= 0 and amount <= 1000000000),
  paid boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'applied', 'replaced')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists family_joint_actions_owner_idx on public.family_joint_actions (owner_id, status);

alter table public.family_joint_actions enable row level security;
drop policy if exists "Joint deposits: the two people read them" on public.family_joint_actions;
create policy "Joint deposits: the two people read them" on public.family_joint_actions
  for select to authenticated using (auth.uid() in (owner_id, partner_id));
revoke insert, update, delete on public.family_joint_actions from anon, authenticated;
grant select on public.family_joint_actions to authenticated;

-- partner: "I deposited" (p_paid true) or "undo" (p_paid false) for one month
create or replace function public.family_joint_deposit(p_family uuid, p_owner uuid, p_saving text, p_month text, p_amount numeric, p_paid boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_saving is null or p_month is null or p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad month or account' using errcode = '22023'; end if;
  if coalesce(p_paid, true) and (p_amount is null or p_amount <= 0 or p_amount > 1000000000) then raise exception 'bad amount' using errcode = '22023'; end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = me)
     or not exists (select 1 from public.family_members where family_id = p_family and user_id = p_owner and role = 'admin') then
    raise exception 'not in this family' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.family_shares s
    where s.family_id = p_family and s.owner_id = p_owner and s.section = 'joint:' || me::text
      and s.data -> 'savings' @> jsonb_build_array(jsonb_build_object('id', p_saving))
  ) then
    raise exception 'that account is not shared with you as joint' using errcode = '42501';
  end if;
  -- a newer note for the same month replaces an older one that was not applied yet
  update public.family_joint_actions set status = 'replaced'
   where owner_id = p_owner and partner_id = me and saving_id = p_saving and month = p_month and status = 'pending';
  insert into public.family_joint_actions (family_id, owner_id, partner_id, saving_id, month, amount, paid)
  values (p_family, p_owner, me, p_saving, p_month, coalesce(p_amount, 0), coalesce(p_paid, true))
  returning id into v_id;
  return v_id;
end $$;

-- admin's app: these notes are now written into the account
create or replace function public.family_joint_applied(p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.family_joint_actions set status = 'applied', applied_at = now()
   where id = any (p_ids) and owner_id = auth.uid() and status = 'pending';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.family_joint_deposit(uuid, uuid, text, text, numeric, boolean), public.family_joint_applied(uuid[]) from public, anon;
grant execute on function public.family_joint_deposit(uuid, uuid, text, text, numeric, boolean), public.family_joint_applied(uuid[]) to authenticated;

commit;
