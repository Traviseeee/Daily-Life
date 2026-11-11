-- MYLIFE · shared "together since" date for a couple in a family (11 Nov 2026).
-- Adds 1 NEW table + RLS + 1 function. Nothing existing is changed or deleted.
-- Run once in the Supabase SQL editor (safe to re-run).
-- Rollback: supabase/migrations/20261111_family_couples_rollback.sql
--
-- Only the two people in the couple can read their row (both must still be in the
-- family). Nobody writes the table directly: family_couple_set() checks that both
-- people are members of that family and that the date makes sense.

begin;

create table if not exists public.family_couples (
  family_id uuid not null references public.families (id) on delete cascade,
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, user_a, user_b),
  check (user_a < user_b)
);

alter table public.family_couples enable row level security;
drop policy if exists "Couple: the two people read it" on public.family_couples;
create policy "Couple: the two people read it" on public.family_couples
  for select to authenticated using (
    auth.uid() in (user_a, user_b)
    and exists (select 1 from public.family_members m where m.family_id = family_couples.family_id and m.user_id = user_a)
    and exists (select 1 from public.family_members m where m.family_id = family_couples.family_id and m.user_id = user_b)
  );
revoke insert, update, delete on public.family_couples from anon, authenticated;
grant select on public.family_couples to authenticated;

-- set (or change) the date for me + my partner in this family
create or replace function public.family_couple_set(p_family uuid, p_partner uuid, p_start date)
returns public.family_couples language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a uuid; b uuid;
  row public.family_couples;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_partner is null or p_partner = me then raise exception 'pick your partner' using errcode = '22023'; end if;
  if p_start is null or p_start > (now() at time zone 'Asia/Phnom_Penh')::date or p_start < date '1900-01-01' then
    raise exception 'date not valid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = me)
     or not exists (select 1 from public.family_members where family_id = p_family and user_id = p_partner) then
    raise exception 'both people must be in this family' using errcode = '42501';
  end if;
  a := least(me, p_partner); b := greatest(me, p_partner);
  insert into public.family_couples (family_id, user_a, user_b, start_date, updated_by)
  values (p_family, a, b, p_start, me)
  on conflict (family_id, user_a, user_b) do update
    set start_date = excluded.start_date, updated_by = me, updated_at = now()
  returning * into row;
  return row;
end $$;

revoke all on function public.family_couple_set(uuid, uuid, date) from public, anon;
grant execute on function public.family_couple_set(uuid, uuid, date) to authenticated;

commit;
