create or replace function public.tg_stores_default_ai_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_ai_agents (store_id, enabled)
  values (new.id, true)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

revoke all on function public.tg_stores_default_ai_agent() from public, anon, authenticated;
grant execute on function public.tg_stores_default_ai_agent() to service_role;

drop trigger if exists stores_default_ai_agent on public.stores;
create trigger stores_default_ai_agent
after insert on public.stores
for each row execute function public.tg_stores_default_ai_agent();