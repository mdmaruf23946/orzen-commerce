ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'ads';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'product_purchase';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'payment_gateway';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'other';