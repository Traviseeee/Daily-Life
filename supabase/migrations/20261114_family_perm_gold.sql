-- Family permission "gold" (មាសសន្សំ): allow the key through the whitelist.
-- Before this, family_clean_permissions() dropped unknown keys, so the switch
-- turned itself off after a refresh. Only the list changes: same function,
-- same signature, one extra key. No data is touched.
create or replace function public.family_clean_permissions(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(coalesce((p ->> k)::boolean, false))), '{}'::jsonb)
  from unnest(array['memories', 'calendar', 'shopping', 'myEvents', 'money', 'bills', 'savings', 'gold']) as k
  where p ? k
$$;
