// Merchant-side reads for a connected website: categories, products (with stock), orders, sync log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Id = z.object({ id: z.string().uuid() });

async function owned(sb: any, id: string) {
  const { data } = await sb.from("landing_page_connections").select("id,store_id").eq("id", id).maybeSingle();
  if (!data) throw new Error("Connection not found");
  return data as { id: string; store_id: string };
}

export const getExternalCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const c = await owned(context.supabase, data.id);
    const [cats, prods] = await Promise.all([
      context.supabase.from("external_site_categories").select("external_id,name,parent_external_id,image_url")
        .eq("connection_id", c.id).order("name").limit(2000),
      context.supabase.from("external_site_products")
        .select("id,external_id,name,sku,price,sale_price,stock,description,image_url,product_url,category_external_id,variants,status,updated_at")
        .eq("connection_id", c.id).order("name").limit(5000),
    ]);
    return { categories: (cats.data ?? []) as any[], products: (prods.data ?? []) as any[] };
  });

export const listExternalSiteOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const c = await owned(context.supabase, data.id);
    const { data: rows } = await context.supabase.from("orders")
      .select("id,invoice_no,customer_name,phone,address,status,subtotal,created_at,external_order_id,courier_name,courier_status,order_items(name_snapshot,qty,price_snapshot)")
      .eq("store_id", c.store_id).eq("landing_page_connection_id", c.id)
      .order("created_at", { ascending: false }).limit(200);
    const { data: sync } = await context.supabase.from("external_site_sync_outbox")
      .select("id,order_id,event,status,attempts,last_error,response_status,created_at,sent_at")
      .eq("connection_id", c.id).order("created_at", { ascending: false }).limit(50);
    return { orders: (rows ?? []) as any[], sync: (sync ?? []) as any[] };
  });

export const retryExternalSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const c = await owned(context.supabase, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("external_site_sync_outbox")
      .update({ status: "queued", run_at: new Date().toISOString() })
      .eq("connection_id", c.id).in("status", ["queued", "failed"]);
    const { dispatchOutbox } = await import("@/lib/external-sites.server");
    return dispatchOutbox(50);
  });
