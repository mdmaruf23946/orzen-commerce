// Admin server functions for the Duplicate Order Protection feature.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwnsStore(supabase: any, storeId: string) {
  const { data, error } = await supabase.rpc("is_store_owner", { _store_id: storeId });
  if (!data) throw new Error("Not authorized for this store");
}

async function resolveMyStoreId(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id");
  if (!data) throw new Error("No store");
  return data.id as string;
}

export const getDuplicateSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_duplicate_protection")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    return (
      data ?? {
        store_id: storeId,
        enabled: false,
        mode: "block",
        period_days: 7,
        rule_phone: true,
        rule_product: true,
        rule_fingerprint: false,
        rule_device: false,
        rule_customer: true,
        match_logic: "any",
      }
    );
  });

export const updateDuplicateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        mode: z.enum(["block", "warn", "off"]),
        period_days: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(15), z.literal(30)]),
        rule_phone: z.boolean(),
        rule_product: z.boolean(),
        rule_fingerprint: z.boolean(),
        rule_device: z.boolean(),
        rule_customer: z.boolean(),
        rule_psid: z.boolean().optional().default(false),
        match_logic: z.enum(["any", "all"]),
        messenger_enabled: z.boolean().optional().default(true),
        messenger_custom_reply: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_protection")
      .upsert({ store_id: storeId, ...data }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDuplicateBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["blocked", "approved", "dismissed", "warned", "all"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    let q = context.supabase
      .from("store_duplicate_blocks")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const dismissBlockedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ blockId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_blocks")
      .update({ status: "dismissed", resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.blockId)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveBlockedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ blockId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    await assertOwnsStore(context.supabase, storeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: block, error: bErr } = await supabaseAdmin
      .from("store_duplicate_blocks")
      .select("*")
      .eq("id", data.blockId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!block) throw new Error("Block not found");
    if (block.status !== "blocked") throw new Error("Already resolved");
    const p: any = block.payload ?? {};

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: block.customer_id,
        customer_name: p.customerName,
        phone: p.phone,
        address: p.address,
        area: p.area ?? null,
        payment_method: p.paymentMethod,
        txn_id: p.txnId ?? null,
        notes: p.notes ?? null,
        subtotal: p.total ?? p.subtotal ?? 0,
        delivery_amount: p.delivery_amount ?? 0,
        discount_amount: p.discount_amount ?? 0,
        status: "pending",
        fingerprint: block.fingerprint,
        device_id: block.device_id,
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Order create failed");

    if (Array.isArray(p.itemRows) && p.itemRows.length > 0) {
      await supabaseAdmin
        .from("order_items")
        .insert(p.itemRows.map((r: any) => ({ ...r, order_id: order.id })));
    }
    await supabaseAdmin
      .from("store_duplicate_blocks")
      .update({
        status: "approved",
        created_order_id: order.id,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.blockId);
    return { ok: true, orderId: order.id };
  });

// Whitelist
export const listWhitelist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_duplicate_whitelist_customers")
      .select("id, customer_id, phone, note, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        customerId: z.string().uuid().optional(),
        phone: z.string().trim().min(3).max(40).optional(),
        note: z.string().trim().max(200).optional(),
      })
      .refine((v) => !!v.customerId || !!v.phone, "customerId or phone required")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_whitelist_customers")
      .insert({
        store_id: storeId,
        customer_id: data.customerId ?? null,
        phone: data.phone ?? null,
        note: data.note ?? null,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWhitelist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_whitelist_customers")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Excluded products
export const listExcludedProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_duplicate_excluded_products")
      .select("id, product_id, created_at, products(name)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.products?.name ?? "",
      created_at: r.created_at,
    }));
  });

export const addExcludedProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_excluded_products")
      .insert({ store_id: storeId, product_id: data.productId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeExcludedProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_duplicate_excluded_products")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStoreProductsForPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await resolveMyStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name")
      .eq("store_id", storeId)
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
