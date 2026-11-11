-- MYLIFE · joint savings accounts are visible to the partner on them (11 Nov 2026).
-- Changes ONLY the rules of public.family_shares (made by 20261111_family_shares.sql):
-- one more kind of section, 'joint:<user id>' = the savings accounts the admin holds
-- together with that person. That person reads it even when the "Savings goals" switch
-- is off; nobody else does. No data is changed or deleted. Safe to re-run.
-- To go back: run 20261111_family_shares.sql again (after removing joint rows) or the rollback.

begin;

alter table public.family_shares drop constraint if exists family_shares_section_check;
alter table public.family_shares add constraint family_shares_section_check
  check (section in ('calendar', 'myEvents', 'money', 'bills', 'savings') or section ~ '^joint:[0-9a-f-]{36}$');

drop policy if exists "Shares: owner, or member with that switch on" on public.family_shares;
create policy "Shares: owner, or member with that switch on" on public.family_shares
  for select to authenticated using (
    exists (select 1 from public.family_members o where o.family_id = family_shares.family_id and o.user_id = family_shares.owner_id)
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.family_members m
        where m.family_id = family_shares.family_id and m.user_id = auth.uid()
          and (
            coalesce((m.permissions ->> family_shares.section)::boolean, false)
            or family_shares.section = 'joint:' || auth.uid()::text
          )
      )
    )
  );

create or replace function public.family_share_put(p_family uuid, p_section text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  stamp timestamptz := now();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_section is null or not (p_section in ('calendar', 'myEvents', 'money', 'bills', 'savings') or p_section ~ '^joint:[0-9a-f-]{36}$') then
    raise exception 'unknown section' using errcode = '22023';
  end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = me and role = 'admin') then
    raise exception 'only a family admin shares' using errcode = '42501';
  end if;
  if p_section like 'joint:%' and not exists (select 1 from public.family_members where family_id = p_family and user_id::text = substr(p_section, 7)) then
    raise exception 'that person is not in this family' using errcode = '22023';
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
