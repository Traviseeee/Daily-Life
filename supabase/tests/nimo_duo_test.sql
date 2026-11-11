create temp table r (ok boolean, name text);
grant all on r to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
insert into public.families (id, owner_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select (public.nimo_duo_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222')).status = 'pending', 'Tra invites Lychee';
do $$ begin perform public.nimo_duo_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444'); insert into r values (false, 'outsider refused'); exception when others then insert into r values (true, 'outsider refused'); end $$;
do $$ begin perform public.nimo_duo_answer((select id from public.nimo_duos limit 1), true); insert into r values (false, 'inviter cannot accept own invite'); exception when others then insert into r values (true, 'inviter cannot accept own invite'); end $$;
do $$ begin insert into public.nimo_duos (family_id, user_a, user_b) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'); insert into r values (false, 'direct insert blocked'); exception when others then insert into r values (true, 'direct insert blocked'); end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select (public.nimo_duo_answer((select id from public.nimo_duos limit 1), true)).status = 'active', 'Lychee accepts';
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into r select count(*) = 0, 'Sophy sees nothing' from public.nimo_duos;
reset role;
-- 8 days of check-ins for both, starting 7 days ago; active since 7 days ago
update public.nimo_duos set active_since = (now() at time zone 'Asia/Phnom_Penh')::date - 7;
insert into public.nimo_xp_history (user_id, xp, activity, dedupe_key)
select u, 1, 'checkin', 'checkin:' || ((now() at time zone 'Asia/Phnom_Penh')::date - g)::text
from unnest(array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid]) u, generate_series(1, 7) g;
-- today only Tra
insert into public.nimo_xp_history (user_id, xp, activity, dedupe_key) values ('11111111-1111-1111-1111-111111111111', 1, 'checkin', 'checkin:' || ((now() at time zone 'Asia/Phnom_Penh')::date)::text);
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select (x -> 0 ->> 'streak')::int = 7 and (x -> 0 ->> 'meToday')::boolean and not (x -> 0 ->> 'partnerToday')::boolean, 'streak 7, alive while waiting for Lychee today' from (select public.nimo_duo_refresh() x) s;
reset role;
insert into r select count(*) = 2, 'both got the 7-day bonus' from public.nimo_xp_history where activity = 'duo';
insert into r select (select xp from public.nimo_profile where user_id = '22222222-2222-2222-2222-222222222222') = 7 + 7, 'Lychee XP updated';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.nimo_duo_refresh();
reset role;
insert into r select count(*) = 2, 'bonus only once' from public.nimo_xp_history where activity = 'duo';
-- a missed day breaks it: remove nothing, simulate Lychee missing 2 days ago via a new duo checkpoint
update public.nimo_duos set active_since = (now() at time zone 'Asia/Phnom_Penh')::date - 1;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select (x -> 0 ->> 'streak')::int = 1, 'counts only from active_since' from (select public.nimo_duo_refresh() x) s;
select public.nimo_duo_leave((select id from public.nimo_duos limit 1));
insert into r select jsonb_array_length(public.nimo_duo_refresh()) = 0, 'left = gone from list';
reset role;
select name, ok from r order by ok, name;
select count(*) filter (where not ok) || '|' || count(*) from r;
