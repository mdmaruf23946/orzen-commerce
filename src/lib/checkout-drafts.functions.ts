// Incomplete checkouts: whatever a shopper typed on checkout is autosaved
// (public, store-scoped upsert by a client draft id). Merchants see drafts
// that were abandoned (idle 10+ min, never converted) in the Incomplete tab.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getOwnedStoreId } from "@/lib/admin-order.server";

const s = (n: number) => z.string().trim().max(n).optional();

export const saveCheckoutDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        storeId: z.string().uuid(),
        name: s(120), phone: s(40), email: s(160), address: s(500), area: s(120),
        items: z
          .array(z.object({ productId: z.string().max(64), name: s(200), qty: z.number().int().min(1).max(999), price: z.number().min(0).max(1e8), image: s(500), variant: s(200) }))
          .max(50),
        total: z.number().min(0).max(1e9),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const hasInfo = [data.name, data.phone, data.email, data.address].some((v) => v && v.length > 0);
    if (!hasInfo) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("checkout_drafts").select("store_id,converted_order_id").eq("id", data.id).maybeSingle();
    if (existing && (existing.store_id !== data.storeId || existing.converted_order_id)) return { ok: true };
    const { data: store } = await supabaseAdmin.from("stores").select("id").eq("id", data.storeId).maybeSingle();
    if (!store) return { ok: false };
    await supabaseAdmin.from("checkout_drafts").upsert({
      id: data.id, store_id: data.storeId,
      customer_name: data.name || null, phone: data.phone || null, email: data.email || null,
      address: data.address || null, area: data.area || null,
      items: data.items as any, total: data.total, updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Called after a successful order so the draft never shows as incomplete. */
export const completeCheckoutDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), storeId: z.string().uuid(), orderId: z.string().max(64).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("checkout_drafts")
      .update({ converted_order_id: data.orderId && /^[0-9a-f-]{36}$/i.test(data.orderId) ? data.orderId : "00000000-0000-0000-0000-000000000000" })
      .eq("id", data.id).eq("store_id", data.storeId);
    return { ok: true };
  });

export type CheckoutDraft = {
  id: string; customer_name: string | null; phone: string | null; email: string | null;
  address: string | null; area: string | null; items: any[]; total: number; updated_at: string; created_at: string;
};

const IDLE_MS = 10 * 60 * 1000;
const digits = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);

export const listCheckoutDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckoutDraft[]> => {
    const sid = await getOwnedStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("checkout_drafts")
      .select("id,customer_name,phone,email,address,area,items,total,updated_at,created_at")
      .eq("store_id", sid).is("converted_order_id", null).eq("dismissed", false)
      .lt("updated_at", new Date(Date.now() - IDLE_MS).toISOString())
      .order("updated_at", { ascending: false }).limit(300);
    const drafts = (data ?? []) as any[];
    if (!drafts.length) return [];
    // Hide drafts whose phone later placed a real order.
    const since = drafts[drafts.length - 1].created_at;
    const { data: orders } = await supabaseAdmin
      .from("orders").select("phone,created_at").eq("store_id", sid).gte("created_at", since).limit(2000);
    const ordered = new Map<string, number>();
    for (const o of orders ?? []) {
      const k = digits(o.phone); const t = +new Date(o.created_at);
      if (k && t > (ordered.get(k) ?? 0)) ordered.set(k, t);
    }
    return drafts.filter((d) => {
      const k = digits(d.phone);
      return !(k && (ordered.get(k) ?? 0) >= +new Date(d.created_at));
    });
  });

export const dismissCheckoutDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await getOwnedStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("checkout_drafts").update({ dismissed: true }).eq("id", data.id).eq("store_id", sid);
    return { ok: true };
  });
