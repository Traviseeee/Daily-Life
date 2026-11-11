-- MYLIFE · Nimo shared streak, small fixes (11 Nov 2026). Needs 20261111_nimo_duo.sql.
-- Replaces 2 functions only; no table or data is changed. Safe to re-run.
--   1. nimo_duo_invite: if the other person already invited me, inviting them back
--      starts the streak right away (before: each kept waiting for the other).
--   2. nimo_duo_refresh: a shared streak ends when one of the two leaves the family.
-- To go back: run 20261111_nimo_duo.sql again (it holds the first versions).

begin;

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
  select * into row from public.nimo_duos where family_id = p_family and user_a = a and user_b = b for update;
  if row.id is null then
    insert into public.nimo_duos (family_id, user_a, user_b, status, invited_by)
    values (p_family, a, b, 'pending', me) returning * into row;
  elsif row.status = 'pending' and row.invited_by is distinct from me then
    -- they asked me first: my invite is my yes
    update public.nimo_duos set status = 'active', active_since = (now() at time zone 'Asia/Phnom_Penh')::date, streak = 0, updated_at = now()
    where id = row.id returning * into row;
  elsif row.status = 'ended' then
    update public.nimo_duos set status = 'pending', invited_by = me, updated_at = now() where id = row.id returning * into row;
  end if;
  return row;
end $$;

create or replace function public.nimo_duo_refresh()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
  d record; day date; n integer; both_today boolean; m integer; bonus integer; who uuid; added integer;
  out jsonb := '[]'::jsonb;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  -- someone left the family → their shared streaks end
  update public.nimo_duos x set status = 'ended', updated_at = now()
  where me in (x.user_a, x.user_b) and x.status <> 'ended'
    and (not exists (select 1 from public.family_members m where m.family_id = x.family_id and m.user_id = x.user_a)
      or not exists (select 1 from public.family_members m where m.family_id = x.family_id and m.user_id = x.user_b));
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

revoke all on function public.nimo_duo_invite(uuid, uuid), public.nimo_duo_refresh() from public, anon;
grant execute on function public.nimo_duo_invite(uuid, uuid), public.nimo_duo_refresh() to authenticated;

commit;
