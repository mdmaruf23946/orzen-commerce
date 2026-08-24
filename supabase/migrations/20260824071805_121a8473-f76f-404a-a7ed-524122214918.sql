CREATE TABLE public.facebook_page_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  page_id text,
  page_name text,
  page_picture_url text,
  page_access_token_encrypted text,
  app_id text,
  app_secret_encrypted text,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_page_integrations TO authenticated;
GRANT ALL ON public.facebook_page_integrations TO service_role;
ALTER TABLE public.facebook_page_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_page_integration_owner_all" ON public.facebook_page_integrations
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER fb_page_integrations_touch BEFORE UPDATE ON public.facebook_page_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.facebook_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  fb_post_id text,
  message text,
  media_url text,
  media_type text not null default 'text',
  link_url text,
  status text not null default 'draft',
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX facebook_posts_store_idx ON public.facebook_posts(store_id, created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_posts TO authenticated;
GRANT ALL ON public.facebook_posts TO service_role;
ALTER TABLE public.facebook_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_posts_owner_all" ON public.facebook_posts
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER fb_posts_touch BEFORE UPDATE ON public.facebook_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.facebook_comments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  comment_id text not null,
  post_id text,
  post_excerpt text,
  author_id text,
  author_name text,
  message text,
  comment_created_at timestamptz,
  hidden boolean not null default false,
  replied boolean not null default false,
  ai_category text,
  ai_suggestion text,
  ai_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, comment_id)
);
CREATE INDEX facebook_comments_store_idx ON public.facebook_comments(store_id, comment_created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_comments TO authenticated;
GRANT ALL ON public.facebook_comments TO service_role;
ALTER TABLE public.facebook_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_comments_owner_all" ON public.facebook_comments
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER fb_comments_touch BEFORE UPDATE ON public.facebook_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.facebook_ai_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'suggest',
  tone text not null default 'friendly',
  language text not null default 'bn',
  auto_reply_safe boolean not null default false,
  auto_hide_spam boolean not null default false,
  suggest_messenger_handoff boolean not null default true,
  allow_keywords text[] not null default '{}',
  deny_keywords text[] not null default '{}',
  custom_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_ai_settings TO authenticated;
GRANT ALL ON public.facebook_ai_settings TO service_role;
ALTER TABLE public.facebook_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_ai_settings_owner_all" ON public.facebook_ai_settings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER fb_ai_settings_touch BEFORE UPDATE ON public.facebook_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();