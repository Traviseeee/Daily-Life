-- MYLIFE · Nimo Life Companion, step 1: XP, level, daily streak.
-- Adds 2 NEW tables + RLS + 7 functions. Existing tables (app_data …), buckets
-- and data are not touched. Run once in the Supabase SQL editor (safe to re-run).
-- Rollback: supabase/migrations/20261105_nimo_core_rollback.sql
--
-- Clients can only READ their own rows. XP is written only by nimo_award(),
-- which knows the fixed reward list, gives each daily reward once per
-- Asia/Phnom_Penh day (unique dedupe key) and works out level and streak itself,
-- so nobody can post their own XP amount from the browser.

begin;

create table if not exists public.nimo_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  seen_level integer not null default 1 check (seen_level >= 1),
  streak integer not null default 0 check (streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_checkin date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nimo_xp_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  xp integer not null check (xp > 0),
  activity text not null check (char_length(activity) <= 40),
  description text not null default '' check (char_length(description) <= 120),
  dedupe_key text not null check (char_length(dedupe_key) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists nimo_xp_history_user_idx on public.nimo_xp_history (user_id, created_at desc);

alter table public.nimo_profile enable row level security;
alter table public.nimo_xp_history enable row level security;

drop policy if exists "Nimo: read own profile" on public.nimo_profile;
create policy "Nimo: read own profile" on public.nimo_profile
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Nimo: read own XP history" on public.nimo_xp_history;
create policy "Nimo: read own XP history" on public.nimo_xp_history
  for select to authenticated using (auth.uid() = user_id);
-- no insert / update / delete policies: only the functions below write.
revoke insert, update, delete on public.nimo_profile, public.nimo_xp_history from anon, authenticated;
grant select on public.nimo_profile, public.nimo_xp_history to authenticated;

-- level from total XP: 0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000,
-- then each next level needs 800, 900, 1000 … more (no top level)
create or replace function public.nimo_level_for(p_xp integer)
returns integer language plpgsql immutable set search_path = '' as $$
declare
  steps integer[] := array[0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
  lvl integer := 1;
  need integer;
  gap integer := 800;
begin
  for i in 2 .. array_length(steps, 1) loop
    if p_xp >= steps[i] then lvl := i; else return lvl; end if;
  end loop;
  need := 3000;
  loop
    need := need + gap;
    exit when p_xp < need;
    lvl := lvl + 1;
    gap := gap + 100;
  end loop;
  return lvl;
end $$;

create or replace function public.nimo_xp_for_level(p_level integer)
returns integer language plpgsql immutable set search_path = '' as $$
declare
  steps integer[] := array[0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
  need integer := 3000;
  gap integer := 800;
begin
  if p_level <= 10 then return steps[greatest(p_level, 1)]; end if;
  for i in 11 .. p_level loop need := need + gap; gap := gap + 100; end loop;
  return need;
end $$;

-- months in a row (ending this month, or last month if this one has nothing yet)
-- where a real loan / bill / savings payment earned XP
create or replace function public.nimo_month_streak(p_user uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  cur date := date_trunc('month', (now() at time zone 'Asia/Phnom_Penh')::date)::date;
  n integer := 0;
begin
  if not exists (select 1 from public.nimo_xp_history where user_id = p_user and activity in ('loan', 'bill', 'save') and right(dedupe_key, 7) = to_char(cur, 'YYYY-MM')) then
    cur := (cur - interval '1 month')::date;
  end if;
  while exists (select 1 from public.nimo_xp_history where user_id = p_user and activity in ('loan', 'bill', 'save') and right(dedupe_key, 7) = to_char(cur, 'YYYY-MM')) loop
    n := n + 1;
    cur := (cur - interval '1 month')::date;
  end loop;
  return n;
end $$;

-- the one writer. p_activity: checkin | expense | summary | savings | finance
-- finance = look at the user's own money records for THIS month and give XP for
-- each real loan payment, paid bill and savings deposit (once each), plus
-- savings milestones and the month-streak bonus. Earlier months are not paid out.
create or replace function public.nimo_award(p_activity text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
  reward integer;
  label text;
  prof public.nimo_profile;
  got jsonb := '[]'::jsonb;
  added integer;
  new_streak integer;
  m integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_activity = 'finance' then return public.nimo_finance(uid); end if;
  reward := case p_activity when 'checkin' then 1 when 'expense' then 1 when 'summary' then 2 when 'savings' then 1 else null end;
  if reward is null then raise exception 'unknown activity' using errcode = '22023'; end if;
  label := case p_activity when 'checkin' then 'Daily check-in' when 'expense' then 'Recorded an expense'
    when 'summary' then 'Reviewed today''s money' else 'Checked savings progress' end;

  -- an expense reward needs an expense dated today in the user's own data
  if p_activity = 'expense' and not exists (
    select 1 from public.app_data a, jsonb_array_elements(coalesce(a.payload -> 'expenses', '[]'::jsonb)) e
    where a.user_id = uid and left(e ->> 'date', 10) = today::text) then
    return jsonb_build_object('awarded', got, 'reason', 'no_expense_today');
  end if;

  insert into public.nimo_profile (user_id) values (uid) on conflict (user_id) do nothing;
  select * into prof from public.nimo_profile where user_id = uid for update;

  insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
  values (uid, reward, p_activity, label, p_activity || ':' || today::text)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  if added > 0 then got := got || jsonb_build_object('activity', p_activity, 'xp', reward); end if;

  -- streak: counted on the daily check-in only
  if p_activity = 'checkin' and added > 0 then
    new_streak := case when prof.last_checkin = today - 1 then prof.streak + 1 else 1 end;
    update public.nimo_profile set streak = new_streak, longest_streak = greatest(longest_streak, new_streak), last_checkin = today
      where user_id = uid;
    foreach m in array array[3, 7, 14, 30, 60, 100, 180, 365] loop
      if new_streak = m then
        insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
        values (uid, case m when 3 then 3 when 7 then 7 when 14 then 10 when 30 then 20 when 60 then 35 when 100 then 50 when 180 then 100 else 150 end,
                'streak', m || '-day streak', 'streak:' || m)
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics added = row_count;
        if added > 0 then got := got || jsonb_build_object('activity', 'streak', 'xp', (select xp from public.nimo_xp_history where user_id = uid and dedupe_key = 'streak:' || m), 'days', m); end if;
      end if;
    end loop;
  end if;

  -- all four daily things done → +3 once a day
  if (select count(*) from public.nimo_xp_history where user_id = uid
      and dedupe_key in ('checkin:' || today, 'expense:' || today, 'summary:' || today, 'savings:' || today)) = 4 then
    insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
    values (uid, 3, 'daily_all', 'Finished all daily goals', 'daily_all:' || today::text)
    on conflict (user_id, dedupe_key) do nothing;
    get diagnostics added = row_count;
    if added > 0 then got := got || jsonb_build_object('activity', 'daily_all', 'xp', 3); end if;
  end if;

  update public.nimo_profile p set
    xp = (select coalesce(sum(h.xp), 0) from public.nimo_xp_history h where h.user_id = uid),
    updated_at = now()
  where p.user_id = uid;
  update public.nimo_profile set level = public.nimo_level_for(xp) where user_id = uid;
  return public.nimo_state() || jsonb_build_object('awarded', got);
end $$;


create or replace function public.nimo_finance(uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Phnom_Penh')::date;
  mon text := to_char((now() at time zone 'Asia/Phnom_Penh')::date, 'YYYY-MM');
  data jsonb;
  got jsonb := '[]'::jsonb;
  rec record;
  added integer;
  total numeric;
  ms integer;
  streak integer;
begin
  select a.payload into data from public.app_data a where a.user_id = uid;
  if data is null then return public.nimo_state() || jsonb_build_object('awarded', got); end if;
  insert into public.nimo_profile (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from public.nimo_profile where user_id = uid for update;

  -- loans: a payment dated this month → +3 per loan
  for rec in select l ->> 'id' id, left(coalesce(l ->> 'name', 'Loan'), 50) nm from jsonb_array_elements(coalesce(data -> 'loans', '[]'::jsonb)) l
    where l ->> 'id' is not null and exists (select 1 from jsonb_array_elements(coalesce(l -> 'payments', '[]'::jsonb)) p where left(p ->> 'date', 7) = mon) loop
    insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
    values (uid, 3, 'loan', 'Paid loan · ' || rec.nm, left('loan:' || rec.id, 70) || ':' || mon) on conflict (user_id, dedupe_key) do nothing;
    get diagnostics added = row_count;
    if added > 0 then got := got || jsonb_build_object('activity', 'loan', 'xp', 3, 'name', rec.nm); end if;
  end loop;

  -- bills: paid this month → +3 when paid by the due date, +1 when late
  for rec in select b ->> 'id' id, left(coalesce(b ->> 'name', 'Bill'), 50) nm,
      case when coalesce(b ->> 'lastPaidDue', '') <> '' and b ->> 'lastPaidAt' <= b ->> 'lastPaidDue' then 3 else 1 end xp
    from jsonb_array_elements(coalesce(data -> 'bills', '[]'::jsonb)) b
    where b ->> 'id' is not null and left(b ->> 'lastPaidAt', 7) = mon loop
    insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
    values (uid, rec.xp, 'bill', case when rec.xp = 3 then 'Paid bill on time · ' else 'Paid bill · ' end || rec.nm, left('bill:' || rec.id, 70) || ':' || mon) on conflict (user_id, dedupe_key) do nothing;
    get diagnostics added = row_count;
    if added > 0 then got := got || jsonb_build_object('activity', 'bill', 'xp', rec.xp, 'name', rec.nm); end if;
  end loop;

  -- savings: this month's deposit ticked → +2 per account
  for rec in select s ->> 'id' id, left(coalesce(s ->> 'name', 'Savings'), 50) nm from jsonb_array_elements(coalesce(data -> 'savings', '[]'::jsonb)) s
    where s ->> 'id' is not null and exists (select 1 from jsonb_array_elements(coalesce(s -> 'contributions', '[]'::jsonb)) c where c ->> 'month' = mon and (c ->> 'paid')::boolean is true) loop
    insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
    values (uid, 2, 'save', 'Saved this month · ' || rec.nm, left('save:' || rec.id, 70) || ':' || mon) on conflict (user_id, dedupe_key) do nothing;
    get diagnostics added = row_count;
    if added > 0 then got := got || jsonb_build_object('activity', 'save', 'xp', 2, 'name', rec.nm); end if;
  end loop;

  -- savings milestones (USD; riel ÷ 4,000). Gold bought from savings still counts
  -- (it is the same money in another form), gold sold comes back as cash.
  select coalesce(sum(case when coalesce(s ->> 'currency', 'USD') = 'KHR' then coalesce((s ->> 'currentAmount')::numeric, 0) / 4000 else coalesce((s ->> 'currentAmount')::numeric, 0) end), 0)
    + coalesce(sum((select coalesce(sum(case when t ->> 'type' = 'gold' then coalesce((t ->> 'purchaseValue')::numeric, (t ->> 'amount')::numeric, 0)
                                              when t ->> 'type' = 'gold-sale' then -coalesce((t ->> 'netProceeds')::numeric, (t ->> 'amount')::numeric, 0) else 0 end), 0)
                    / case when coalesce(s ->> 'currency', 'USD') = 'KHR' then 4000 else 1 end
                    from jsonb_array_elements(coalesce(s -> 'transactions', '[]'::jsonb)) t)), 0)
    into total from jsonb_array_elements(coalesce(data -> 'savings', '[]'::jsonb)) s;
  foreach ms in array array[50, 150, 300, 500, 1000, 2500, 5000, 10000] loop
    exit when total < ms;
    insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
    values (uid, case ms when 50 then 1 when 150 then 3 when 300 then 5 when 500 then 8 when 1000 then 15 when 2500 then 20 when 5000 then 30 else 50 end,
            'milestone', 'Savings reached $' || ms, 'milestone:' || ms) on conflict (user_id, dedupe_key) do nothing;
    get diagnostics added = row_count;
    if added > 0 then got := got || jsonb_build_object('activity', 'milestone', 'xp', (select xp from public.nimo_xp_history where user_id = uid and dedupe_key = 'milestone:' || ms), 'amount', ms); end if;
  end loop;

  -- month streak bonus: 3 / 6 / 12 months in a row (once each)
  streak := public.nimo_month_streak(uid);
  foreach ms in array array[3, 6, 12] loop
    if streak >= ms then
      insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key)
      values (uid, case ms when 3 then 10 when 6 then 20 else 40 end, 'mstreak', ms || ' money months in a row', 'mstreak:' || ms) on conflict (user_id, dedupe_key) do nothing;
      get diagnostics added = row_count;
      if added > 0 then got := got || jsonb_build_object('activity', 'mstreak', 'xp', case ms when 3 then 10 when 6 then 20 else 40 end, 'months', ms); end if;
    end if;
  end loop;

  update public.nimo_profile p set xp = (select coalesce(sum(h.xp), 0) from public.nimo_xp_history h where h.user_id = uid), updated_at = now() where p.user_id = uid;
  update public.nimo_profile set level = public.nimo_level_for(xp) where user_id = uid;
  return public.nimo_state() || jsonb_build_object('awarded', got);
end $$;

-- what the home card needs: level, XP, next level, streak, today's ticks
create or replace function public.nimo_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'xp', coalesce(p.xp, 0), 'level', coalesce(p.level, 1), 'seenLevel', coalesce(p.seen_level, 1),
    'levelXp', public.nimo_xp_for_level(coalesce(p.level, 1)), 'nextXp', public.nimo_xp_for_level(coalesce(p.level, 1) + 1),
    'streak', case when p.last_checkin >= (now() at time zone 'Asia/Phnom_Penh')::date - 1 then coalesce(p.streak, 0) else 0 end,
    'longestStreak', coalesce(p.longest_streak, 0),
    'monthStreak', public.nimo_month_streak(auth.uid()),
    'month', coalesce((select jsonb_agg(jsonb_build_object('activity', h.activity, 'xp', h.xp, 'text', h.description) order by h.created_at)
      from public.nimo_xp_history h where h.user_id = auth.uid() and h.activity in ('loan', 'bill', 'save')
      and right(h.dedupe_key, 7) = to_char((now() at time zone 'Asia/Phnom_Penh')::date, 'YYYY-MM')), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(h.activity) from public.nimo_xp_history h where h.user_id = auth.uid()
      and h.dedupe_key like '%:' || ((now() at time zone 'Asia/Phnom_Penh')::date)::text), '[]'::jsonb),
    'todayXp', coalesce((select sum(h.xp) from public.nimo_xp_history h where h.user_id = auth.uid()
      and h.created_at >= ((now() at time zone 'Asia/Phnom_Penh')::date)::timestamp at time zone 'Asia/Phnom_Penh'), 0))
  from (select 1) one left join public.nimo_profile p on p.user_id = auth.uid()
$$;

-- level-up popup shown → remember it (can only move up to the real level)
create or replace function public.nimo_seen(p_level integer)
returns void language sql security definer set search_path = '' as $$
  update public.nimo_profile set seen_level = least(greatest(seen_level, p_level), level) where user_id = auth.uid()
$$;

revoke all on function public.nimo_award(text), public.nimo_state(), public.nimo_seen(integer), public.nimo_finance(uuid), public.nimo_month_streak(uuid) from public, anon, authenticated;
grant execute on function public.nimo_award(text), public.nimo_state(), public.nimo_seen(integer) to authenticated;
grant execute on function public.nimo_level_for(integer), public.nimo_xp_for_level(integer) to authenticated;

commit;
