create or replace function public.platform_routing_hosts()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'root_domain', coalesce(lower(s.settings->>'root_domain'), 'orzen.top'),
    'login_host', lower(coalesce(s.settings->>'login_host','')),
    'dns_target', lower(coalesce(s.settings->>'dns_target',''))
  )
  from public.platform_settings s
  where s.id = 1
$$;

grant execute on function public.platform_routing_hosts() to anon, authenticated, service_role;