-- Local test for 20261023_family_posts.sql. Users: A owner/admin, B member
-- (memories on), D viewer (memories on), E member (memories OFF), C outsider,
-- + anonymous. One transaction, ends with ROLLBACK.
-- Local throwaway Postgres only (tools/verify-family-posts.sh) — never on Supabase.
begin;
create temp table r (n serial, test text, expected text, actual text) on commit drop;
create temp table v (k text primary key, val text) on commit drop;
grant all on r, v to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555')
on conflict do nothing;

-- files already in the bucket (uploaded by A, B and C into their own folders)
insert into storage.objects (bucket_id, name, owner) values
  ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/p1/a.jpg', '11111111-1111-1111-1111-111111111111'),
  ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/p1/a-thumb.jpg', '11111111-1111-1111-1111-111111111111'),
  ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/p9/private.jpg', '11111111-1111-1111-1111-111111111111'),
  ('family-media', 'users/22222222-2222-2222-2222-222222222222/posts/q1/b.jpg', '22222222-2222-2222-2222-222222222222'),
  ('family-media', 'users/33333333-3333-3333-3333-333333333333/posts/x/c.jpg', '33333333-3333-3333-3333-333333333333');

-- A makes the family and invites B (member), D (viewer), E (member, memories off)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare f uuid; begin
  f := public.create_family('Chin family', 'Tra');
  insert into v values ('fid', f::text);
  insert into v values ('tB', public.create_family_invite(f, 'member', '{"memories":true}'::jsonb));
  insert into v values ('tD', public.create_family_invite(f, 'viewer', '{"memories":true}'::jsonb));
  insert into v values ('tE', public.create_family_invite(f, 'member', '{"memories":false,"calendar":true}'::jsonb));
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.accept_family_invite((select val from v where k = 'tB'), 'Mak');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select public.accept_family_invite((select val from v where k = 'tD'), 'Yeay');
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select public.accept_family_invite((select val from v where k = 'tE'), 'Pou');

-- A shares one memory (copy: points to A's files)
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); pid uuid; n int; paths text[]; begin
  insert into public.family_posts (family_id, source_id, caption, taken_on, media)
    values (f, 'memories-1', 'Kampot trip', '2026-10-01',
      '[{"path":"users/11111111-1111-1111-1111-111111111111/posts/p1/a.jpg","thumb":"users/11111111-1111-1111-1111-111111111111/posts/p1/a-thumb.jpg","type":"image"}]')
    returning id, media_paths into pid, paths;
  insert into v values ('pA', pid::text);
  insert into r (test, expected, actual) values ('A: shares a memory', 'ok', case when pid is not null then 'ok' else 'no' end);
  insert into r (test, expected, actual) values ('A: readable paths come from media (path + thumb)', '2 paths', cardinality(paths) || ' paths');
  begin
    insert into public.family_posts (family_id, source_id, media) values (f, 'memories-1', '[]');
    insert into r (test, expected, actual) values ('A: same memory shared twice', 'denied', 'allowed');
  exception when unique_violation then insert into r (test, expected, actual) values ('A: same memory shared twice', 'denied', 'denied'); end;
  begin
    insert into public.family_posts (family_id, source_id, media)
      values (f, 'steal', '[{"path":"users/33333333-3333-3333-3333-333333333333/posts/x/c.jpg","type":"image"}]');
    insert into r (test, expected, actual) values ('A: post with someone else''s file', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: post with someone else''s file', 'denied', 'denied'); end;
  begin
    insert into public.family_posts (family_id, source_id, media)
      values (f, 'dots', '[{"path":"users/11111111-1111-1111-1111-111111111111/../33333333-3333-3333-3333-333333333333/posts/x/c.jpg","type":"image"}]');
    insert into r (test, expected, actual) values ('A: path with ../', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: path with ../', 'denied', 'denied'); end;
  begin
    update public.family_posts set media_paths = array['users/33333333-3333-3333-3333-333333333333/posts/x/c.jpg'] where id = pid;
    select media_paths into paths from public.family_posts where id = pid;
    insert into r (test, expected, actual) values ('A: can''t set media_paths by hand', 'own only',
      case when 'users/33333333-3333-3333-3333-333333333333/posts/x/c.jpg' = any(paths) then 'leaked' else 'own only' end);
  end;
  begin
    insert into public.family_posts (family_id, author_id, source_id, media) values (f, '22222222-2222-2222-2222-222222222222', 'fake', '[]');
    insert into r (test, expected, actual) values ('A: posts as B', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: posts as B', 'denied', 'denied'); end;
  select count(*) into n from storage.objects where bucket_id = 'family-media';
  insert into r (test, expected, actual) values ('A: own files still readable', 'sees 3', 'sees ' || n);
end $$;

-- B (member): sees it, sees only the shared files, likes, comments, posts own
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); pid uuid := (select val::uuid from v where k = 'pA'); n int; begin
  select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('B: sees family posts', 'sees 1', 'sees ' || n);
  select count(*) into n from storage.objects where bucket_id = 'family-media' and name like 'users/1111%';
  insert into r (test, expected, actual) values ('B: reads only A''s shared files (not p9/private)', 'sees 2', 'sees ' || n);
  select count(*) into n from storage.objects where name like 'users/3333%'; insert into r (test, expected, actual) values ('B: reads C''s files', 'sees 0', 'sees ' || n);
  insert into public.family_post_likes (post_id) values (pid);
  insert into public.family_post_comments (post_id, text) values (pid, 'ស្អាតណាស់!');
  select count(*) into n from public.family_post_comments; insert into r (test, expected, actual) values ('B: comments', 'sees 1', 'sees ' || n);
  update public.family_posts set caption = 'hacked' where id = pid; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B: edits A''s post', 'changed 0', 'changed ' || n);
  delete from public.family_posts where id = pid; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B: deletes A''s post', 'deleted 0', 'deleted ' || n);
  insert into public.family_posts (family_id, source_id, caption, media)
    values (f, 'memories-b1', 'Mak cooking', '[{"path":"users/22222222-2222-2222-2222-222222222222/posts/q1/b.jpg","type":"image"}]')
    returning id into pid;
  insert into v values ('pB', pid::text);
  insert into r (test, expected, actual) values ('B: posts own memory', 'ok', 'ok');
  begin
    insert into public.family_post_likes (post_id, user_id) values ((select val::uuid from v where k = 'pA'), '44444444-4444-4444-4444-444444444444');
    insert into r (test, expected, actual) values ('B: likes as D', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: likes as D', 'denied', 'denied'); end;
end $$;

-- D (viewer): sees + ❤️, but can't post or comment
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); pid uuid := (select val::uuid from v where k = 'pA'); n int; begin
  select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('D (viewer): sees posts', 'sees 2', 'sees ' || n);
  insert into public.family_post_likes (post_id) values (pid);
  insert into r (test, expected, actual) values ('D (viewer): likes', 'ok', 'ok');
  begin insert into public.family_post_comments (post_id, text) values (pid, 'hi');
    insert into r (test, expected, actual) values ('D (viewer): comments', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D (viewer): comments', 'denied', 'denied'); end;
  begin insert into public.family_posts (family_id, source_id, media) values (f, 'd1', '[]');
    insert into r (test, expected, actual) values ('D (viewer): posts', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D (viewer): posts', 'denied', 'denied'); end;
  delete from public.family_post_likes where user_id = '22222222-2222-2222-2222-222222222222'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('D: removes B''s ❤️', 'deleted 0', 'deleted ' || n);
end $$;

-- E (member, memories OFF): sees nothing, can't post
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); n int; begin
  select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('E (memories off): sees posts', 'sees 0', 'sees ' || n);
  select count(*) into n from storage.objects where name like 'users/1111%'; insert into r (test, expected, actual) values ('E (memories off): reads files', 'sees 0', 'sees ' || n);
  select count(*) into n from public.family_post_comments; insert into r (test, expected, actual) values ('E (memories off): sees comments', 'sees 0', 'sees ' || n);
  begin insert into public.family_posts (family_id, source_id, media) values (f, 'e1', '[]');
    insert into r (test, expected, actual) values ('E (memories off): posts', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('E (memories off): posts', 'denied', 'denied'); end;
end $$;

-- C (outsider): nothing at all
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); n int; begin
  select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('C: sees posts', 'sees 0', 'sees ' || n);
  select count(*) into n from storage.objects where name like 'users/1111%' or name like 'users/2222%'; insert into r (test, expected, actual) values ('C: reads family files', 'sees 0', 'sees ' || n);
  select count(*) into n from public.family_post_likes; insert into r (test, expected, actual) values ('C: sees likes', 'sees 0', 'sees ' || n);
  begin insert into public.family_posts (family_id, source_id, media) values (f, 'c1', '[]');
    insert into r (test, expected, actual) values ('C: posts into A family', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: posts into A family', 'denied', 'denied'); end;
  begin insert into public.family_post_likes (post_id) values ((select val::uuid from v where k = 'pA'));
    insert into r (test, expected, actual) values ('C: likes A''s post', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: likes A''s post', 'denied', 'denied'); end;
  begin insert into public.family_post_comments (post_id, text) values ((select val::uuid from v where k = 'pA'), 'spam');
    insert into r (test, expected, actual) values ('C: comments on A''s post', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: comments on A''s post', 'denied', 'denied'); end;
end $$;

-- A (admin): deletes B's comment and B's post; then removes D → D sees nothing
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from public.family_post_likes where post_id = (select val::uuid from v where k = 'pA');
  insert into r (test, expected, actual) values ('A: sees ❤️ on own post', 'sees 2', 'sees ' || n);
  delete from public.family_post_comments; get diagnostics n = row_count; insert into r (test, expected, actual) values ('A (admin/author): deletes a comment', 'deleted 1', 'deleted ' || n);
  delete from public.family_posts where id = (select val::uuid from v where k = 'pB'); get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('A (admin): deletes B''s post', 'deleted 1', 'deleted ' || n);
  select count(*) into n from storage.objects where name like 'users/2222%'; insert into r (test, expected, actual) values ('A: B''s file after the post is gone', 'sees 0', 'sees ' || n);
  delete from public.family_members where user_id = '44444444-4444-4444-4444-444444444444';
end $$;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('D removed: sees posts', 'sees 0', 'sees ' || n);
  select count(*) into n from storage.objects where name like 'users/1111%'; insert into r (test, expected, actual) values ('D removed: reads files', 'sees 0', 'sees ' || n);
end $$;

-- anonymous
reset role; set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare n int; begin
  begin select count(*) into n from public.family_posts; insert into r (test, expected, actual) values ('anon: reads posts', 'denied', 'sees ' || n);
  exception when others then insert into r (test, expected, actual) values ('anon: reads posts', 'denied', 'denied'); end;
  select count(*) into n from storage.objects where bucket_id = 'family-media'; insert into r (test, expected, actual) values ('anon: reads files', 'sees 0', 'sees ' || n);
end $$;

-- the personal memory data (app_data) is not part of any of this
reset role;
insert into r (test, expected, actual) select 'files are never deleted by these tables', '5 files', count(*) || ' files' from storage.objects;

select n, test, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end from r order by n;
select count(*) filter (where expected <> actual) as failures, count(*) as total from r;
rollback;
