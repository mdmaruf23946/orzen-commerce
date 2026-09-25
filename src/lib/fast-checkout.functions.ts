import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().trim().min(32).max(200);

export const getFastCheckout = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: tokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const { readConversationalCheckout } = await import("@/lib/conversational-checkout.server");
    const session = await readConversationalCheckout(data.token);
    if (!session || session.used_at || new Date(session.expires_at).getTime() <= Date.now()) {
      return { available: false as const, reason: session?.used_at ? "used" : "expired" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: store }, { data: product }, { data: zones }] = await Promise.all([
      supabaseAdmin.from("stores").select("id,name,slug,logo_url,payments_config,delivery,status").eq("id", session.store_id).maybeSingle(),
      supabaseAdmin.from("products").select("id,name,price,old_price,stock,status,product_type,primary_image_url").eq("id", session.product_id).eq("store_id", session.store_id).maybeSingle(),
      supabaseAdmin.rpc("get_public_delivery_zones", { _store_id: session.store_id }),
    ]);
    if (!store || store.status !== "active" || !product || product.status !== "active" || product.product_type !== "physical") {
      return { available: false as const, reason: "unavailable" };
    }
    const { listConversationalGateways } = await import("@/lib/conversational-checkout.server");
    const gateways = await listConversationalGateways(session.store_id);
    const payments = (store.payments_config ?? {}) as Record<string, any>;
    const methods = [
      ...(payments.cod?.enabled !== false ? [{ id: "cod", label: "Cash on Delivery", detail: "পণ্য হাতে পেয়ে পেমেন্ট করুন", online: false }] : []),
      ...gateways.map((gateway) => ({ id: gateway.key, label: gateway.label, detail: "নিরাপদ অনলাইন পেমেন্ট", online: true })),
      ...(payments.bkash?.enabled !== false && payments.bkash?.number ? [{ id: "bkash", label: "bKash", detail: `Send Money: ${payments.bkash.number}`, online: false, manual: true }] : []),
      ...(payments.nagad?.enabled !== false && payments.nagad?.number ? [{ id: "nagad", label: "Nagad", detail: `Send Money: ${payments.nagad.number}`, online: false, manual: true }] : []),
    ];
    return {
      available: true as const,
      store: { id: store.id, name: store.name, slug: store.slug, logoUrl: store.logo_url },
      product: { id: product.id, name: product.name, price: Number(product.price), oldPrice: product.old_price ? Number(product.old_price) : null, stock: Number(product.stock), imageUrl: product.primary_image_url },
      quantity: session.quantity,
      zones: ((zones as any[]) ?? []).map((zone) => ({ id: zone.id, name: zone.name, charge: Number(zone.charge), eta: zone.eta, isDefault: zone.is_default })),
      methods,
    };
  });
