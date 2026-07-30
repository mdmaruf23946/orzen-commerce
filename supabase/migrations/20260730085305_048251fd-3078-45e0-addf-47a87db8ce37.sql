CREATE TABLE public.invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'store' CHECK (scope IN ('global','store')),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  canvas jsonb NOT NULL DEFAULT '{"page":{"width":794,"height":1123,"margin":32},"elements":[]}'::jsonb,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_template_id uuid,
  created_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_templates_scope_store CHECK (
    (scope = 'global' AND store_id IS NULL) OR (scope = 'store' AND store_id IS NOT NULL)
  )
);

CREATE INDEX invoice_templates_store_idx ON public.invoice_templates(store_id);
CREATE INDEX invoice_templates_scope_idx ON public.invoice_templates(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_templates TO authenticated;
GRANT ALL ON public.invoice_templates TO service_role;

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read global templates"
  ON public.invoice_templates FOR SELECT TO authenticated
  USING (scope = 'global');

CREATE POLICY "Owners manage global templates"
  ON public.invoice_templates FOR ALL TO authenticated
  USING (scope = 'global' AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (scope = 'global' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Store owners manage own templates"
  ON public.invoice_templates FOR ALL TO authenticated
  USING (scope = 'store' AND public.is_store_owner(store_id))
  WITH CHECK (scope = 'store' AND public.is_store_owner(store_id));

CREATE TRIGGER invoice_templates_touch
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Only one default template per store
CREATE OR REPLACE FUNCTION public.tg_invoice_template_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default AND NEW.store_id IS NOT NULL THEN
    UPDATE public.invoice_templates
       SET is_default = false
     WHERE store_id = NEW.store_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER invoice_templates_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.invoice_templates
  FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.tg_invoice_template_single_default();

-- Seed global templates
INSERT INTO public.invoice_templates (scope, store_id, name, description, sort_order, brand, canvas) VALUES
('global', NULL, 'Modern Minimal', 'Clean typographic layout with plenty of whitespace.', 1,
 '{"primary":"#111827","secondary":"#6b7280","accent":"#2563eb","font":"Inter, system-ui, sans-serif","footerStyle":"line","borderStyle":"solid","radius":8,"shadow":"none","margin":32}'::jsonb,
 '{"page":{"width":794,"height":1123,"margin":32},"elements":[
   {"id":"logo","type":"logo","x":32,"y":32,"w":120,"h":56,"z":1,"props":{"radius":6,"opacity":1,"fit":"contain"}},
   {"id":"title","type":"text","x":520,"y":32,"w":242,"h":40,"z":2,"props":{"content":"INVOICE","fontSize":30,"fontWeight":800,"color":"@primary","align":"right","letterSpacing":2,"lineHeight":1.2}},
   {"id":"invno","type":"text","x":520,"y":76,"w":242,"h":20,"z":3,"props":{"content":"#{{invoice_number}}","fontSize":13,"fontWeight":500,"color":"@secondary","align":"right","lineHeight":1.4}},
   {"id":"invdate","type":"text","x":520,"y":98,"w":242,"h":20,"z":4,"props":{"content":"{{current_date}}","fontSize":13,"fontWeight":400,"color":"@secondary","align":"right","lineHeight":1.4}},
   {"id":"storeinfo","type":"text","x":32,"y":98,"w":300,"h":80,"z":5,"props":{"content":"{{store_name}}\n{{store_address}}\n{{store_phone}}","fontSize":13,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.6}},
   {"id":"div1","type":"divider","x":32,"y":190,"w":730,"h":1,"z":6,"props":{"color":"@secondary","thickness":1}},
   {"id":"billto","type":"text","x":32,"y":206,"w":300,"h":100,"z":7,"props":{"content":"BILL TO\n{{customer_name}}\n{{customer_phone}}\n{{customer_address}}","fontSize":13,"fontWeight":400,"color":"@primary","align":"left","lineHeight":1.6}},
   {"id":"orderinfo","type":"text","x":470,"y":206,"w":292,"h":100,"z":8,"props":{"content":"Order: {{order_id}}\nPayment: {{payment_method}} ({{payment_status}})\nCourier: {{courier_name}} {{tracking_id}}","fontSize":13,"fontWeight":400,"color":"@secondary","align":"right","lineHeight":1.6}},
   {"id":"table","type":"table","x":32,"y":330,"w":730,"h":300,"z":9,"props":{"headerColor":"@primary","headerTextColor":"#ffffff","rowColor":"#ffffff","altRowColor":"#f9fafb","border":"#e5e7eb","padding":10,"rowHeight":36,"radius":8,"showImage":true,"imageSize":34,"fontSize":12,"columns":["image","name","qty","price","total"]}},
   {"id":"totals","type":"totals","x":452,"y":650,"w":310,"h":130,"z":10,"props":{"fontSize":13,"color":"@primary","accent":"@accent","showDiscount":true,"showDelivery":true}},
   {"id":"qrtrack","type":"qr","x":32,"y":660,"w":110,"h":130,"z":11,"props":{"source":"tracking","size":100,"label":"Track order","border":false}},
   {"id":"terms","type":"text","x":32,"y":900,"w":460,"h":90,"z":12,"props":{"content":"Terms & Conditions\nProducts once sold can be returned within 7 days in original condition.","fontSize":11,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.6}},
   {"id":"thanks","type":"text","x":32,"y":1030,"w":730,"h":24,"z":13,"props":{"content":"Thank you for shopping with {{store_name}}","fontSize":12,"fontWeight":600,"color":"@accent","align":"center","lineHeight":1.4}}
 ]}'::jsonb),
('global', NULL, 'Premium Corporate', 'Structured header band with corporate tone.', 2,
 '{"primary":"#0f172a","secondary":"#64748b","accent":"#0ea5e9","font":"Inter, system-ui, sans-serif","footerStyle":"band","borderStyle":"solid","radius":4,"shadow":"sm","margin":28}'::jsonb,
 '{"page":{"width":794,"height":1123,"margin":28},"elements":[
   {"id":"band","type":"shape","x":0,"y":0,"w":794,"h":120,"z":0,"props":{"fill":"@primary","radius":0}},
   {"id":"logo","type":"logo","x":28,"y":30,"w":110,"h":60,"z":1,"props":{"radius":4,"opacity":1,"fit":"contain"}},
   {"id":"title","type":"text","x":480,"y":32,"w":286,"h":36,"z":2,"props":{"content":"INVOICE","fontSize":28,"fontWeight":800,"color":"#ffffff","align":"right","letterSpacing":3,"lineHeight":1.2}},
   {"id":"invno","type":"text","x":480,"y":72,"w":286,"h":36,"z":3,"props":{"content":"#{{invoice_number}}  •  {{current_date}}","fontSize":12,"fontWeight":400,"color":"#e2e8f0","align":"right","lineHeight":1.4}},
   {"id":"storeinfo","type":"text","x":28,"y":146,"w":320,"h":90,"z":4,"props":{"content":"{{store_name}}\n{{store_address}}\n{{store_phone}}","fontSize":12,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.6}},
   {"id":"billto","type":"text","x":440,"y":146,"w":326,"h":90,"z":5,"props":{"content":"BILL TO\n{{customer_name}}\n{{customer_phone}}\n{{customer_address}}","fontSize":12,"fontWeight":400,"color":"@primary","align":"right","lineHeight":1.6}},
   {"id":"orderinfo","type":"text","x":28,"y":250,"w":738,"h":24,"z":6,"props":{"content":"Order {{order_id}}  |  {{payment_method}} — {{payment_status}}  |  {{courier_name}} {{tracking_id}}","fontSize":12,"fontWeight":500,"color":"@accent","align":"left","lineHeight":1.4}},
   {"id":"table","type":"table","x":28,"y":290,"w":738,"h":320,"z":7,"props":{"headerColor":"@primary","headerTextColor":"#ffffff","rowColor":"#ffffff","altRowColor":"#f1f5f9","border":"#cbd5e1","padding":10,"rowHeight":38,"radius":4,"showImage":true,"imageSize":36,"fontSize":12,"columns":["image","name","sku","qty","price","total"]}},
   {"id":"totals","type":"totals","x":446,"y":640,"w":320,"h":140,"z":8,"props":{"fontSize":13,"color":"@primary","accent":"@accent","showDiscount":true,"showDelivery":true}},
   {"id":"qrtrack","type":"qr","x":28,"y":650,"w":120,"h":140,"z":9,"props":{"source":"tracking","size":110,"label":"Track","border":true}},
   {"id":"qrpay","type":"qr","x":160,"y":650,"w":120,"h":140,"z":10,"props":{"source":"payment","size":110,"label":"Pay","border":true}},
   {"id":"terms","type":"text","x":28,"y":880,"w":500,"h":100,"z":11,"props":{"content":"Terms & Conditions\nAll goods remain the property of {{store_name}} until paid in full.","fontSize":11,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.6}},
   {"id":"footerband","type":"shape","x":0,"y":1043,"w":794,"h":80,"z":12,"props":{"fill":"@primary","radius":0}},
   {"id":"thanks","type":"text","x":28,"y":1070,"w":738,"h":26,"z":13,"props":{"content":"Thank you for your business","fontSize":13,"fontWeight":600,"color":"#ffffff","align":"center","lineHeight":1.4}}
 ]}'::jsonb),
('global', NULL, 'E-Commerce Colorful', 'Friendly retail look with accent blocks and product images.', 3,
 '{"primary":"#7c3aed","secondary":"#6b7280","accent":"#f59e0b","font":"Inter, system-ui, sans-serif","footerStyle":"card","borderStyle":"solid","radius":14,"shadow":"md","margin":30}'::jsonb,
 '{"page":{"width":794,"height":1123,"margin":30},"elements":[
   {"id":"card","type":"shape","x":30,"y":26,"w":734,"h":120,"z":0,"props":{"fill":"@primary","radius":16}},
   {"id":"logo","type":"logo","x":52,"y":50,"w":110,"h":70,"z":1,"props":{"radius":10,"opacity":1,"fit":"contain"}},
   {"id":"title","type":"text","x":420,"y":50,"w":320,"h":38,"z":2,"props":{"content":"INVOICE","fontSize":30,"fontWeight":800,"color":"#ffffff","align":"right","letterSpacing":1,"lineHeight":1.2}},
   {"id":"invno","type":"text","x":420,"y":92,"w":320,"h":34,"z":3,"props":{"content":"#{{invoice_number}} • {{current_date}}","fontSize":12,"fontWeight":500,"color":"#f5f3ff","align":"right","lineHeight":1.4}},
   {"id":"billto","type":"text","x":30,"y":170,"w":340,"h":100,"z":4,"props":{"content":"SHIP TO\n{{customer_name}}\n{{customer_phone}}\n{{customer_address}}","fontSize":13,"fontWeight":400,"color":"@primary","align":"left","lineHeight":1.6}},
   {"id":"storeinfo","type":"text","x":420,"y":170,"w":344,"h":100,"z":5,"props":{"content":"{{store_name}}\n{{store_address}}\n{{store_phone}}","fontSize":12,"fontWeight":400,"color":"@secondary","align":"right","lineHeight":1.6}},
   {"id":"orderpill","type":"text","x":30,"y":286,"w":734,"h":26,"z":6,"props":{"content":"Order {{order_id}} • {{payment_method}} ({{payment_status}}) • {{courier_name}} {{tracking_id}}","fontSize":12,"fontWeight":600,"color":"@accent","align":"left","lineHeight":1.4}},
   {"id":"table","type":"table","x":30,"y":326,"w":734,"h":330,"z":7,"props":{"headerColor":"@primary","headerTextColor":"#ffffff","rowColor":"#ffffff","altRowColor":"#faf5ff","border":"#e9d5ff","padding":12,"rowHeight":44,"radius":14,"showImage":true,"imageSize":40,"fontSize":12,"columns":["image","name","variant","qty","price","total"]}},
   {"id":"totals","type":"totals","x":444,"y":680,"w":320,"h":140,"z":8,"props":{"fontSize":14,"color":"@primary","accent":"@accent","showDiscount":true,"showDelivery":true}},
   {"id":"qrtrack","type":"qr","x":30,"y":690,"w":130,"h":150,"z":9,"props":{"source":"tracking","size":120,"label":"Track your parcel","border":false}},
   {"id":"terms","type":"text","x":30,"y":880,"w":460,"h":90,"z":10,"props":{"content":"Return Policy\nEasy 7-day return on unused items with original packaging.","fontSize":11,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.6}},
   {"id":"thanks","type":"text","x":30,"y":1020,"w":734,"h":40,"z":11,"props":{"content":"Thanks for shopping with {{store_name}}! 💜","fontSize":14,"fontWeight":700,"color":"@primary","align":"center","lineHeight":1.4}}
 ]}'::jsonb),
('global', NULL, 'Luxury Brand', 'Serif type, generous spacing and gold accents.', 4,
 '{"primary":"#1c1917","secondary":"#78716c","accent":"#b58a3c","font":"Georgia, ''Times New Roman'', serif","footerStyle":"line","borderStyle":"thin","radius":0,"shadow":"none","margin":44}'::jsonb,
 '{"page":{"width":794,"height":1123,"margin":44},"elements":[
   {"id":"logo","type":"logo","x":337,"y":44,"w":120,"h":70,"z":1,"props":{"radius":0,"opacity":1,"fit":"contain"}},
   {"id":"storename","type":"text","x":44,"y":124,"w":706,"h":34,"z":2,"props":{"content":"{{store_name}}","fontSize":24,"fontWeight":700,"color":"@primary","align":"center","letterSpacing":4,"lineHeight":1.3}},
   {"id":"title","type":"text","x":44,"y":164,"w":706,"h":26,"z":3,"props":{"content":"I N V O I C E","fontSize":13,"fontWeight":500,"color":"@accent","align":"center","letterSpacing":6,"lineHeight":1.4}},
   {"id":"div1","type":"divider","x":44,"y":204,"w":706,"h":1,"z":4,"props":{"color":"@accent","thickness":1}},
   {"id":"billto","type":"text","x":44,"y":226,"w":340,"h":110,"z":5,"props":{"content":"Prepared for\n{{customer_name}}\n{{customer_phone}}\n{{customer_address}}","fontSize":12,"fontWeight":400,"color":"@primary","align":"left","lineHeight":1.8}},
   {"id":"meta","type":"text","x":410,"y":226,"w":340,"h":110,"z":6,"props":{"content":"Invoice {{invoice_number}}\nOrder {{order_id}}\n{{current_date}}\n{{payment_method}} — {{payment_status}}","fontSize":12,"fontWeight":400,"color":"@secondary","align":"right","lineHeight":1.8}},
   {"id":"table","type":"table","x":44,"y":364,"w":706,"h":300,"z":7,"props":{"headerColor":"#ffffff","headerTextColor":"@primary","rowColor":"#ffffff","altRowColor":"#ffffff","border":"@accent","padding":12,"rowHeight":40,"radius":0,"showImage":false,"imageSize":32,"fontSize":12,"columns":["name","qty","price","total"]}},
   {"id":"totals","type":"totals","x":440,"y":690,"w":310,"h":140,"z":8,"props":{"fontSize":13,"color":"@primary","accent":"@accent","showDiscount":true,"showDelivery":true}},
   {"id":"qrtrack","type":"qr","x":44,"y":700,"w":120,"h":140,"z":9,"props":{"source":"tracking","size":110,"label":"Track","border":false}},
   {"id":"terms","type":"text","x":44,"y":900,"w":460,"h":90,"z":10,"props":{"content":"Terms\nEach piece is inspected before dispatch. Exchanges within 7 days.","fontSize":11,"fontWeight":400,"color":"@secondary","align":"left","lineHeight":1.8}},
   {"id":"div2","type":"divider","x":44,"y":1010,"w":706,"h":1,"z":11,"props":{"color":"@accent","thickness":1}},
   {"id":"thanks","type":"text","x":44,"y":1030,"w":706,"h":26,"z":12,"props":{"content":"With gratitude — {{store_name}}","fontSize":12,"fontWeight":500,"color":"@accent","align":"center","letterSpacing":2,"lineHeight":1.4}}
 ]}'::jsonb);