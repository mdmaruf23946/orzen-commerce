ALTER TABLE public.store_ai_agents
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fallback_message text NOT NULL DEFAULT 'দুঃখিত, এই তথ্যটি আমার কাছে নেই। আমি স্টোর অ্যাডমিনকে জানিয়ে দিচ্ছি।',
  ADD COLUMN IF NOT EXISTS product_recommendations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_assistance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_focused boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recommend_related boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ask_for_info boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escalate_to_human boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '{"products":true,"stock":true,"categories":true,"delivery":true,"payments":true,"returns":true,"warranty":true,"store_info":true,"business_hours":true}'::jsonb;