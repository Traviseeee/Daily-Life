-- Local test for 20261022_family_media_bucket.sql (two users A/B + anonymous).
-- Runs in one transaction and ends with ROLLBACK.
begin;
create temp table r (n serial, test text, expected text, actual text) on commit drop;
grant all on r to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
insert into storage.objects (bucket_id, name, owner) values
  ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/p1/1.jpg', '11111111-1111-1111-1111-111111111111'),
  ('family-media', 'users/22222222-2222-2222-2222-222222222222/posts/p2/1.jpg', '22222222-2222-2222-2222-222222222222'),
  ('images', 'users/11111111-1111-1111-1111-111111111111/memories/old.jpg', '11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare n int; begin
  begin insert into storage.objects (bucket_id, name) values ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/p3/1.jpg'); insert into r (test, expected, actual) values ('A uploads to own folder', 'allowed', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A uploads to own folder', 'allowed', 'denied'); end;
  begin insert into storage.objects (bucket_id, name) values ('family-media', 'users/22222222-2222-2222-2222-222222222222/posts/x/1.jpg'); insert into r (test, expected, actual) values ('A uploads into B folder', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A uploads into B folder', 'denied', 'denied'); end;
  begin insert into storage.objects (bucket_id, name) values ('family-media', 'posts/loose.jpg'); insert into r (test, expected, actual) values ('A uploads outside users/', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A uploads outside users/', 'denied', 'denied'); end;
  select count(*) into n from storage.objects where bucket_id = 'family-media'; insert into r (test, expected, actual) values ('A lists family-media', 'sees 2', 'sees ' || n);
  delete from storage.objects where bucket_id = 'family-media' and name like 'users/2222%'; get diagnostics n = row_count; insert into r (test, expected, actual) values ('A deletes B file', 'deleted 0', 'deleted ' || n);
  delete from storage.objects where bucket_id = 'family-media' and name like '%/p3/1.jpg'; get diagnostics n = row_count; insert into r (test, expected, actual) values ('A deletes own file', 'deleted 1', 'deleted ' || n);
  select count(*) into n from storage.objects where bucket_id = 'images'; insert into r (test, expected, actual) values ('images bucket rules unchanged (A sees own)', 'sees 1', 'sees ' || n);
end $$;
reset role; set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare n int; begin
  begin select count(*) into n from storage.objects where bucket_id = 'family-media'; insert into r (test, expected, actual) values ('anonymous lists family-media', 'sees 0', 'sees ' || n);
  exception when others then insert into r (test, expected, actual) values ('anonymous lists family-media', 'sees 0', 'sees 0'); end;
  begin insert into storage.objects (bucket_id, name) values ('family-media', 'users/11111111-1111-1111-1111-111111111111/posts/a/1.jpg'); insert into r (test, expected, actual) values ('anonymous uploads', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('anonymous uploads', 'denied', 'denied'); end;
end $$;
reset role;
select n, test, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end from r order by n;
select count(*) filter (where expected <> actual) as failures, count(*) as total from r;
select id, public from storage.buckets where id = 'family-media';
rollback;
