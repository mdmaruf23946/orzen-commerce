
create or replace function public.seed_store_ai_agent_state(_store_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.store_ai_agent_state (store_id, agent_key, enabled, status)
  select _store_id, a.key, true,
         case when a.key in ('messenger','whatsapp','facebook') then 'needs_setup' else 'active' end
  from (values ('master'),('messenger'),('whatsapp'),('facebook'),('sales'),
               ('order'),('customer'),('courier'),('notification'),('handoff')) as a(key)
  on conflict (store_id, agent_key) do nothing;
$$;

create or replace function public.tg_seed_store_ai_agent_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_store_ai_agent_state(new.id);
  return new;
end;
$$;

revoke execute on function public.seed_store_ai_agent_state(uuid) from anon, authenticated, public;
revoke execute on function public.tg_seed_store_ai_agent_state() from anon, authenticated, public;

drop trigger if exists trg_seed_store_ai_agent_state on public.stores;
create trigger trg_seed_store_ai_agent_state
after insert on public.stores
for each row execute function public.tg_seed_store_ai_agent_state();

-- Backfill every existing store.
do $$
declare s record;
begin
  for s in select id from public.stores loop
    perform public.seed_store_ai_agent_state(s.id);
  end loop;
end $$;
