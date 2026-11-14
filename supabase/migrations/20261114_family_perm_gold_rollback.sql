-- Undo: back to the original whitelist (gold switch will be dropped again).
create or replace function public.family_clean_permissions(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(coalesce((p ->> k)::boolean, false))), '{}'::jsonb)
  from unnest(array['memories', 'calendar', 'shopping', 'myEvents', 'money', 'bills', 'savings']) as k
  where p ? k
$$;
