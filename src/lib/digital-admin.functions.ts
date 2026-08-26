// Store Admin operations for digital orders: access control, licenses,
// delivery emails and the audit log. Every function is scoped to the
// signed-in owner's store.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const data = await myStoreRow(supabase, userId, "id");
  return data?.id ?? null;
}

const orderInput = z.object({ orderId: z.string().uuid() });
const entInput = z.object({ entitlementId: z.string().uuid() });

/** Full digital picture of one order for the admin drawer. */
export const getOrderDigitalAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return null;
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

    const { data: order } = await sb
      .from("orders")
      .select("id,store_id,customer_name,email,phone,payment_status,payment_gateway_name,payment_method,created_at")
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!order) return null;

    const { data: rows } = await sb
      .from("digital_entitlements")
      .select("id,product_id,status,download_count,max_downloads,expires_at,version,license_id,created_at")
      .eq("order_id", data.orderId)
      .eq("store_id", storeId);
    if (!rows?.length) return { order, items: [], events: [] };

    const [{ data: products }, { data: licenses }, { data: events }] = await Promise.all([
      sb.from("products").select("id,name,meta").in("id", rows.map((r: any) => r.product_id)),
      rows.some((r: any) => r.license_id)
        ? sb
            .from("digital_licenses")
            .select("id,license_key,license_type,status,activation_count,max_activations")
            .in("id", rows.map((r: any) => r.license_id).filter(Boolean))
        : Promise.resolve({ data: [] as any[] }),
      sb
        .from("digital_access_events")
        .select("id,action,detail,created_at")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const pById = new Map((products ?? []).map((p: any) => [p.id, p]));
    const lById = new Map((licenses ?? []).map((l: any) => [l.id, l]));

    return {
      order,
      items: rows.map((r: any) => {
        const p = pById.get(r.product_id);
        const lic = r.license_id ? lById.get(r.license_id) : null;
        return {
          id: r.id,
          productId: r.product_id,
          name: p?.name ?? "Product",
          version: (p?.meta as any)?.digital?.version ?? r.version ?? null,
          status: r.status as string,
          downloadCount: r.download_count as number,
          maxDownloads: r.max_downloads as number | null,
          remaining:
            r.max_downloads == null ? null : Math.max(0, r.max_downloads - (r.download_count ?? 0)),
          expiresAt: r.expires_at as string | null,
          license: lic
            ? {
                key: lic.license_key as string,
                type: lic.license_type as string,
                status: lic.status as string,
                activations: lic.activation_count as number,
                maxActivations: lic.max_activations as number | null,
              }
            : null,
        };
      }),
      events: events ?? [],
    };
  });

/** Enables or disables customer access to one entitlement. */
export const setDigitalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => entInput.extend({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: ent } = await sb
      .from("digital_entitlements")
      .select("id,order_id,store_id")
      .eq("id", data.entitlementId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!ent) throw new Error("Entitlement not found");
    await sb
      .from("digital_entitlements")
      .update({ status: data.enabled ? "active" : "revoked" })
      .eq("id", ent.id);
    const { logDigitalEvent } = await import("@/lib/digital.server");
    await logDigitalEvent(sb as any, {
      storeId,
      orderId: ent.order_id as string,
      entitlementId: ent.id as string,
      actor: context.userId,
      action: data.enabled ? "access_enabled" : "access_disabled",
    });
    return { ok: true };
  });

/** Issues a brand new license key for one entitlement. */
export const regenerateDigitalLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => entInput.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: ent } = await sb
      .from("digital_entitlements")
      .select("id")
      .eq("id", data.entitlementId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!ent) throw new Error("Entitlement not found");
    const { regenerateLicenseFor } = await import("@/lib/digital.server");
    return regenerateLicenseFor(sb as any, data.entitlementId);
  });

/** Re-sends the download email for a digital order. */
export const resendDigitalEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: order } = await sb
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const { sendDigitalDeliveryEmail } = await import("@/lib/digital.server");
    return sendDigitalDeliveryEmail(sb as any, data.orderId);
  });

/** Download log for one entitlement (device / IP audit). */
export const listDigitalDownloadLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => entInput.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return [];
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await sb
      .from("digital_downloads")
      .select("id,ip,device_id,user_agent,created_at")
      .eq("entitlement_id", data.entitlementId)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });
