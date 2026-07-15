alter table public.store_domains
  add column if not exists cf_hostname_id text,
  add column if not exists cf_status text,
  add column if not exists cf_ssl_status text,
  add column if not exists cf_ownership jsonb,
  add column if not exists cf_ssl_validation jsonb;

create index if not exists store_domains_cf_hostname_id_idx
  on public.store_domains (cf_hostname_id);