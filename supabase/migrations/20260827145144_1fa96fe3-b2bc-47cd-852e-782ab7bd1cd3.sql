create or replace function public.get_global_header_banner()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select settings -> 'global_banner' from public.platform_settings where id = 1), '{}'::jsonb)
$$;

revoke all on function public.get_global_header_banner() from public;
grant execute on function public.get_global_header_banner() to anon, authenticated, service_role;