import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listStoreOnlineGateways, placeOrder, startOnlineCheckout } from "@/lib/storefront.functions";

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
    const gateways = await listStoreOnlineGateways({ data: { storeId: session.store_id } });
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

export const submitFastCheckout = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    token: tokenSchema,
    customerName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(9).max(40),
    email: z.string().trim().email().max(160).optional(),
    address: z.string().trim().min(3).max(500),
    area: z.string().trim().max(120).optional(),
    deliveryZoneId: z.string().uuid().optional(),
    paymentMethod: z.string().trim().min(2).max(120),
    txnId: z.string().trim().max(120).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const checkout = await import("@/lib/conversational-checkout.server");
    const session = await checkout.claimConversationalCheckout(data.token);
    if (!session) throw new Error("এই checkout link-এর মেয়াদ শেষ অথবা এটি ইতিমধ্যে ব্যবহার করা হয়েছে।");
    try {
      const result = await placeOrder({ data: {
        storeId: session.store_id,
        customerName: data.customerName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        area: data.area,
        deliveryZoneId: data.deliveryZoneId,
        paymentMethod: data.paymentMethod,
        txnId: data.txnId,
        items: [{ productId: session.product_id, qty: session.quantity }],
      } });
      await checkout.attachConversationalOrder(session.id, result.orderId);
      const online = data.paymentMethod.startsWith("builtin:") || data.paymentMethod.startsWith("custom:");
      if (online) {
        const payment = await startOnlineCheckout({ data: { orderId: result.orderId, gatewayKey: data.paymentMethod } });
        return { orderId: result.orderId, redirectUrl: payment.redirect_url ?? null, warning: result.warning };
      }
      await checkout.notifyConversationalOrder(result.orderId, false);
      return { orderId: result.orderId, redirectUrl: null, warning: result.warning };
    } catch (error) {
      await checkout.releaseConversationalCheckout(session.id);
      throw error;
    }
  });