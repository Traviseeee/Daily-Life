-- MYLIFE · Nimo shared streak ("streak រួមគ្នា") between two family members (11 Nov 2026).
-- Adds 1 NEW table + RLS + 4 functions. Needs 20261105_nimo_core.sql and the family tables.
-- Nothing existing is changed or deleted. Safe to re-run.
-- Rollback: supabase/migrations/20261111_nimo_duo_rollback.sql
--
-- A day counts only when BOTH people did their Nimo check-in that Asia/Phnom_Penh day
-- (read from nimo_xp_history, which only the server writes). Missing a day starts the
-- shared streak again from 0; each person's own streak is not touched.
-- Bonuses 7 / 30 / 100 days give each person +7 / +20 / +50 XP once per duo.

begin;

create table if not exists public.nimo_duos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'ended')),
  invited_by uuid references auth.users (id) on delete set null,
  active_since date,
  streak integer not null default 0 check (streak >= 0),
  longest integer not null default 0 check (longest >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (family_id, user_a, user_b)
);

alter table public.nimo_duos enable row level security;
drop policy if exists "Nimo duo: the two people read it" on public.nimo_duos;
create policy "Nimo duo: the two people read it" on public.nimo_duos
  for select to authenticated using (auth.uid() in (user_a, user_b));
revoke insert, update, delete on public.nimo_duos from anon, authenticated;
grant select on public.nimo_duos to authenticated;

-- ask a family member to share a streak (again, if it had ended)
create or replace function public.nimo_duo_invite(p_family uuid, p_partner uuid)
returns public.nimo_duos language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a uuid; b uuid; row public.nimo_duos;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_partner is null or p_partner = me then raise exception 'pick someone else' using errcode = '22023'; end if;
  if not exists (select 1 from public.family_members where family_id = p_family and user_id = me)
     or not exists (select 1 from public.family_members where family_id = p_family and user_id = p_partner) then
    raise exception 'both people must be in this family' using errcode = '42501';
  end if;
  a := least(me, p_partner); b := greatest(me, p_partner);
  insert into public.nimo_duos (family_id, user_a, user_b, status, invited_by)
  values (p_family, a, b, 'pending', me)
  on conflict (family_id, user_a, user_b) do update
    set status = case when public.nimo_duos.status = 'active' then 'active' else 'pending' end,
        invited_by = case when public.nimo_duos.status = 'active' then public.nimo_duos.invited_by else me end,
        updated_at = now()
  returning * into row;
  return row;
end $$;

-- the invited person says yes / no
create or replace function public.nimo_duo_answer(p_duo uuid, p_yes boolean)
returns public.nimo_duos language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); row public.nimo_duos;
begin
  select * into row from public.nimo_duos where id = p_duo for update;
  if row.id is null or me not in (row.user_a, row.user_b) then raise exception 'not your streak' using errcode = '42501'; end if;
  if row.status <> 'pending' or row.invited_by = me then raise exception 'nothing to answer' using errcode = '22023'; end if;
  update public.nimo_duos set
    status = case when p_yes then 'active' else 'ended' end,
    active_since = case when p_yes then (now() at time zone 'Asia/Phnom_Penh')::date else active_since end,
    streak = 0, updated_at = now()
  where id = p_duo returning * into row;
  return row;
end $$;

-- either person can stop sharing
create or replace function public.nimo_duo_leave(p_duo uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.nimo_duos set status = 'ended', updated_at = now()
  where id = p_duo and me in (user_a, user_b) and status <> 'ended';
end $$;

-- count every active duo of mine again from the check-ins and give milestone XP; returns the list for the app
create or replace function public.nimo_duo_refresh()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
  d record; day date; n integer; both_today boolean; m integer; bonus integer; who uuid; added integer;
  out jsonb := '[]'::jsonb;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  for d in select * from public.nimo_duos where me in (user_a, user_b) and status <> 'ended' loop
    n := 0;
    if d.status = 'active' then
      both_today := (select count(distinct h.user_id) from public.nimo_xp_history h where h.user_id in (d.user_a, d.user_b) and h.dedupe_key = 'checkin:' || today::text) = 2;
      day := case when both_today then today else today - 1 end;
      while day >= coalesce(d.active_since, today) and
        (select count(distinct h.user_id) from public.nimo_xp_history h where h.user_id in (d.user_a, d.user_b) and h.dedupe_key = 'checkin:' || day::text) = 2 loop
        n := n + 1;
        day := day - 1;
      end loop;
      update public.nimo_duos set streak = n, longest = greatest(longest, n), updated_at = now() where id = d.id;
      foreach m in array array[7, 30, 100] loop
        if n >= m then
          bonus := case m when 7 then 7 when 30 then 20 else 50 end;
          foreach who in array array[d.user_a, d.user_b] loop
            insert into public.nimo_profile (user_id) values (who) on conflict (user_id) do nothing;
            insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
            values (who, bonus, 'duo', m || '-day shared streak', left('duo:' || d.id::text || ':' || m, 80))
            on conflict (user_id, dedupe_key) do nothing;
            get diagnostics added = row_count;
            if added > 0 then
              update public.nimo_profile p set xp = (select coalesce(sum(h.xp), 0) from public.nimo_xp_history h where h.user_id = who), updated_at = now() where p.user_id = who;
              update public.nimo_profile set level = public.nimo_level_for(xp) where user_id = who;
            end if;
          end loop;
        end if;
      end loop;
    end if;
    out := out || jsonb_build_object(
      'id', d.id, 'family', d.family_id, 'status', d.status, 'invitedBy', d.invited_by,
      'partner', case when d.user_a = me then d.user_b else d.user_a end,
      'streak', n, 'longest', greatest(d.longest, n),
      'meToday', exists (select 1 from public.nimo_xp_history h where h.user_id = me and h.dedupe_key = 'checkin:' || today::text),
      'partnerToday', exists (select 1 from public.nimo_xp_history h where h.user_id = case when d.user_a = me then d.user_b else d.user_a end and h.dedupe_key = 'checkin:' || today::text));
  end loop;
  return out;
end $$;

revoke all on function public.nimo_duo_invite(uuid, uuid), public.nimo_duo_answer(uuid, boolean), public.nimo_duo_leave(uuid), public.nimo_duo_refresh() from public, anon;
grant execute on function public.nimo_duo_invite(uuid, uuid), public.nimo_duo_answer(uuid, boolean), public.nimo_duo_leave(uuid), public.nimo_duo_refresh() to authenticated;

commit;
