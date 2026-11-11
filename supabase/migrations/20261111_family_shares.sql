-- MYLIFE · what the family admin lets members see (11 Nov 2026).
-- Adds 1 NEW table + RLS + 1 function. Nothing existing is changed or deleted.
-- Run once in the Supabase SQL editor (safe to re-run).
-- Rollback: supabase/migrations/20261111_family_shares_rollback.sql
--
-- The admin's app puts a read-only COPY of each allowed section here (calendar,
-- myEvents, money, bills, savings). A member reads a section only while the admin
-- has that switch ON for them (family_members.permissions). Nobody writes the
-- table directly: family_share_put() checks the caller is an admin of that family.
-- The admin's real data stays in app_state and is never touched by this.

begin;

create table if not exists public.family_shares (
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  section text not null check (section in ('calendar', 'myEvents', 'money', 'bills', 'savings')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (family_id, owner_id, section)
);

alter table public.family_shares enable row level security;
drop policy if exists "Shares: owner, or member with that switch on" on public.family_shares;
create policy "Shares: owner, or member with that switch on" on public.family_shares
  for select to authenticated using (
    exists (select 1 from public.family_members o where o.family_id = family_shares.family_id and o.user_id = family_shares.owner_id)
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.family_members m
        where m.family_id = family_shares.family_id and m.user_id = auth.uid()
          and coalesce((m.permissions ->> family_shares.section)::boolean, false)
      )
    )
  );
revoke insert, update, delete on public.family_shares from anon, authenticated;
grant select on public.family_shares to authenticated;

-- the admin's app saves (or empties, with '{}') the copy of one section
create or replace function public.family_share_put(p_family uuid, p_section text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  stamp timestamptz := now();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_section is null or p_section not in ('calendar', 'myEvents', 'money', 'bills', 'savings') then
    raise exception 'unknown section' using errcode = '22023';
  end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = me and role = 'admin') then
    raise exception 'only a family admin shares' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then p_data := '{}'::jsonb; end if;
  if octet_length(p_data::text) > 1000000 then raise exception 'too much data' using errcode = '22023'; end if;
  insert into public.family_shares (family_id, owner_id, section, data, updated_at)
  values (p_family, me, p_section, p_data, stamp)
  on conflict (family_id, owner_id, section) do update set data = excluded.data, updated_at = stamp;
  return stamp;
end $$;
revoke all on function public.family_share_put(uuid, text, jsonb) from public, anon;
grant execute on function public.family_share_put(uuid, text, jsonb) to authenticated;

commit;
