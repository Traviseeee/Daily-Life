-- run as superuser on a throwaway db; prints "fails|total" at the end
create temp table r (ok boolean, name text);
grant all on r to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
insert into public.app_data (user_id, payload) values ('11111111-1111-1111-1111-111111111111', jsonb_build_object('expenses', jsonb_build_array(jsonb_build_object('date', ((now() at time zone 'Asia/Phnom_Penh')::date)::text, 'amount', 2))));
insert into r select public.nimo_level_for(0) = 1 and public.nimo_level_for(49) = 1 and public.nimo_level_for(50) = 2 and public.nimo_level_for(3000) = 10 and public.nimo_level_for(3800) = 11 and public.nimo_level_for(4699) = 11 and public.nimo_level_for(4700) = 12, 'level table';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select (public.nimo_award('checkin') -> 'xp')::int = 1, 'checkin +1';
insert into r select jsonb_array_length(public.nimo_award('checkin') -> 'awarded') = 0, 'checkin twice = no XP';
insert into r select (public.nimo_award('expense') -> 'xp')::int = 2, 'expense today +1';
insert into r select (public.nimo_award('summary') -> 'xp')::int = 4, 'summary +2';
insert into r select (public.nimo_award('savings') -> 'xp')::int = 8, 'savings +1 and all-done +3';
insert into r select (public.nimo_state() -> 'streak')::int = 1, 'streak 1';
insert into r select jsonb_array_length(public.nimo_state() -> 'today') = 5, 'today ticks';
do $$ begin perform public.nimo_award('bogus'); insert into r values (false, 'bogus rejected'); exception when others then insert into r values (true, 'bogus rejected'); end $$;
do $$ begin insert into public.nimo_xp_history (user_id, xp, activity, dedupe_key) values (auth.uid(), 999, 'x', 'x'); insert into r values (false, 'client insert blocked'); exception when others then insert into r values (true, 'client insert blocked'); end $$;
do $$ begin update public.nimo_profile set xp = 9999; insert into r values (not found, 'client update blocked'); exception when others then insert into r values (true, 'client update blocked'); end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select (select count(*) from public.nimo_xp_history) = 0, 'other user sees nothing';
insert into r select (public.nimo_award('expense') -> 'awarded') = '[]'::jsonb, 'no expense = no XP';
reset role;
-- streak continues from yesterday, 3-day bonus once
insert into public.nimo_profile (user_id, streak, last_checkin) values ('22222222-2222-2222-2222-222222222222', 2, (now() at time zone 'Asia/Phnom_Penh')::date - 1);
set role authenticated;
insert into r select (a -> 'streak')::int = 3 and (a -> 'xp')::int = 4 , 'streak 3 + bonus 3' from (select public.nimo_award('checkin') a) s;
reset role;
-- finance: real records this month
insert into auth.users values ('33333333-3333-3333-3333-333333333333');
insert into public.app_data (user_id, payload) values ('33333333-3333-3333-3333-333333333333', jsonb_build_object(
  'loans', jsonb_build_array(jsonb_build_object('id', 'L1', 'name', 'Car', 'payments', jsonb_build_array(jsonb_build_object('date', to_char((now() at time zone 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD'))))),
  'bills', jsonb_build_array(jsonb_build_object('id', 'B1', 'name', 'EDC', 'lastPaidAt', to_char((now() at time zone 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD'), 'lastPaidDue', '2999-01-01'),
                             jsonb_build_object('id', 'B2', 'name', 'Old', 'lastPaidAt', '2001-01-01')),
  'savings', jsonb_build_array(jsonb_build_object('id', 'S1', 'name', 'Fund', 'currentAmount', 100, 'contributions', jsonb_build_array(jsonb_build_object('month', to_char((now() at time zone 'Asia/Phnom_Penh')::date, 'YYYY-MM'), 'paid', true)),
    'transactions', jsonb_build_array(jsonb_build_object('type', 'gold', 'purchaseValue', 60))))));
-- last month's loan reward already earned → streak 2
insert into public.nimo_xp_history (user_id, xp, activity, description, dedupe_key) values ('33333333-3333-3333-3333-333333333333', 3, 'loan', 'x', 'loan:L1:' || to_char((now() at time zone 'Asia/Phnom_Penh')::date - interval '1 month', 'YYYY-MM'));
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into r select (a -> 'xp')::int = 3 + 3 + 3 + 2 + 1 + 3 and jsonb_array_length(a -> 'awarded') = 5, 'finance: loan 3, bill on time 3, save 2, milestones 50+150' from (select public.nimo_award('finance') a) s;
insert into r select jsonb_array_length(public.nimo_award('finance') -> 'awarded') = 0, 'finance twice = no XP';
insert into r select (public.nimo_state() -> 'monthStreak')::int = 2, 'month streak 2';
insert into r select jsonb_array_length(public.nimo_state() -> 'month') = 3, 'this month list';
do $$ begin perform public.nimo_finance('11111111-1111-1111-1111-111111111111'); insert into r values (false, 'nimo_finance not callable'); exception when others then insert into r values (true, 'nimo_finance not callable'); end $$;
reset role;
select name, ok from r order by ok, name;
select count(*) filter (where not ok) || '|' || count(*) from r;
