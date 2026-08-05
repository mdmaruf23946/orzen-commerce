// Invoice template CRUD + invoice payload resolution + email sharing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enqueueEmail } from "@/lib/emails.server";
import { buildTrackingUrl } from "@/lib/couriers/status";
import type { InvoiceData } from "@/lib/invoice-template/data";

const canvasSchema = z.object({
  page: z.object({
    width: z.number(),
    height: z.number(),
    margin: z.number(),
    kind: z.string().optional(),
    preset: z.string().optional(),
  }),
  elements: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
      rot: z.number().optional(),
      z: z.number().optional(),
      locked: z.boolean().optional(),
      hidden: z.boolean().optional(),
      props: z.record(z.string(), z.any()).default({}),
    }),
  ),
});

const brandSchema = z.record(z.string(), z.any());

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function isOwner(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  return !!data;
}

export const listInvoiceTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("invoice_templates")
      .select("*")
      .order("scope")
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((t: any) => t.scope === "global" || t.store_id === sid);
    // usage = how many templates were derived from this one (presets adopted by stores)
    const usage: Record<string, number> = {};
    for (const t of data ?? []) {
      if (t.source_template_id) usage[t.source_template_id] = (usage[t.source_template_id] ?? 0) + 1;
    }
    return {
      templates: rows.map((t: any) => ({ ...t, usage_count: usage[t.id] ?? 0 })),
      storeId: sid,
      isOwner: await isOwner(context.supabase, context.userId),
    };
  });

export const saveInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        scope: z.enum(["global", "store"]).default("store"),
        name: z.string().trim().min(1).max(80),
        description: z.string().max(300).nullable().optional(),
        canvas: canvasSchema,
        brand: brandSchema,
        is_default: z.boolean().optional(),
        sort_order: z.number().int().optional(),
        category: z.string().trim().max(40).optional(),
        is_hidden: z.boolean().optional(),
        page_size: z.string().trim().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.scope === "global" && !(await isOwner(sb, context.userId))) throw new Error("Forbidden");
    const sid = data.scope === "store" ? await myStoreId(sb, context.userId) : null;
    if (data.scope === "store" && !sid) throw new Error("No store");
    const row: any = {
      scope: data.scope,
      store_id: sid,
      name: data.name,
      description: data.description ?? null,
      canvas: data.canvas,
      brand: data.brand,
      sort_order: data.sort_order ?? 0,
    };
    if (data.is_default !== undefined) row.is_default = data.is_default;
    if (data.category !== undefined) row.category = data.category;
    if (data.is_hidden !== undefined) row.is_hidden = data.is_hidden;
    if (data.page_size !== undefined) row.page_size = data.page_size;
    if (data.id) {
      // snapshot the previous state so it can be restored later
      const { data: prev } = await sb
        .from("invoice_templates")
        .select("canvas,brand,name")
        .eq("id", data.id)
        .maybeSingle();
      const { error } = await sb.from("invoice_templates").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (prev) {
        await sb.from("invoice_template_versions").insert({
          template_id: data.id,
          canvas: prev.canvas,
          brand: prev.brand,
          name: prev.name,
          created_by: context.userId,
        });
      }
      return { id: data.id };
    }
    row.created_by = context.userId;
    const { data: created, error } = await sb.from("invoice_templates").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const setInvoiceTemplateVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("invoice_templates")
      .update({ is_hidden: data.hidden })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInvoiceTemplateVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoice_template_versions")
      .select("id,name,label,created_at,canvas,brand")
      .eq("template_id", data.templateId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { versions: rows ?? [] };
  });

export const restoreInvoiceTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid(), versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: v, error } = await sb
      .from("invoice_template_versions")
      .select("canvas,brand")
      .eq("id", data.versionId)
      .eq("template_id", data.templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) throw new Error("Version not found");
    const { data: cur } = await sb
      .from("invoice_templates")
      .select("canvas,brand,name")
      .eq("id", data.templateId)
      .maybeSingle();
    const { error: e2 } = await sb
      .from("invoice_templates")
      .update({ canvas: v.canvas, brand: v.brand })
      .eq("id", data.templateId);
    if (e2) throw new Error(e2.message);
    if (cur) {
      await sb.from("invoice_template_versions").insert({
        template_id: data.templateId,
        canvas: cur.canvas,
        brand: cur.brand,
        name: cur.name,
        label: "before restore",
        created_by: context.userId,
      });
    }
    return { ok: true, canvas: v.canvas, brand: v.brand };
  });

export const deleteInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoice_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copy a template (usually a global preset) into the current store. */
export const duplicateInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), name: z.string().trim().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) throw new Error("No store");
    const { data: src, error } = await sb.from("invoice_templates").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Template not found");
    const { data: created, error: e2 } = await sb
      .from("invoice_templates")
      .insert({
        scope: "store",
        store_id: sid,
        name: data.name || `${src.name} copy`,
        description: src.description,
        canvas: src.canvas,
        brand: src.brand,
        source_template_id: src.id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);
    return { id: created.id as string };
  });

export const setDefaultInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) throw new Error("No store");
    await sb.from("invoice_templates").update({ is_default: false }).eq("store_id", sid).eq("is_default", true);
    const { error } = await sb
      .from("invoice_templates")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Full payload for rendering one order's invoice: data + chosen template. */
export const getInvoicePayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), templateId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) throw new Error("No store");

    const [{ data: order }, { data: items }, { data: store }, { data: profile }] = await Promise.all([
      sb.from("orders").select("*").eq("id", data.orderId).eq("store_id", sid).maybeSingle(),
      sb.from("order_items").select("*, products(primary_image_url, sku)").eq("order_id", data.orderId),
      sb.from("stores").select("name,phone,address,email,logo_url,slug,website").eq("id", sid).maybeSingle(),
      sb.from("store_invoice_profile").select("*").eq("store_id", sid).maybeSingle(),
    ]);
    if (!order) throw new Error("Order not found");

    let template: any = null;
    if (data.templateId) {
      const { data: t } = await sb.from("invoice_templates").select("*").eq("id", data.templateId).maybeSingle();
      template = t;
    }
    if (!template) {
      const { data: t } = await sb
        .from("invoice_templates")
        .select("*")
        .eq("store_id", sid)
        .eq("is_default", true)
        .maybeSingle();
      template = t;
    }
    if (!template) {
      const { data: t } = await sb
        .from("invoice_templates")
        .select("*")
        .eq("scope", "global")
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      template = t;
    }

    const list = (items ?? []).map((it: any) => ({
      name: it.name_snapshot,
      sku: it.products?.sku ?? null,
      variant: it.variant_label ?? null,
      image: it.products?.primary_image_url ?? null,
      qty: Number(it.qty),
      price: Number(it.price_snapshot),
      total: Number(it.price_snapshot) * Number(it.qty),
    }));
    const itemsTotal = list.reduce((a: number, b: any) => a + b.total, 0);
    const delivery = Number(order.delivery_amount ?? 0);
    const discount = Number(order.discount_amount ?? 0);
    const total = Number(order.subtotal ?? itemsTotal + delivery - discount);
    const paid = order.payment_status === "paid" ? total : 0;

    const p: any = profile ?? {};
    const invoice: InvoiceData = {
      store: {
        name: p.business_name || store?.name || "",
        address: p.business_address || store?.address || null,
        phone: p.phone || store?.phone || null,
        email: p.email || store?.email || null,
        website: p.website || store?.website || null,
        logo: p.show_logo === false ? null : p.logo_url || store?.logo_url || null,
        owner_name: p.owner_name ?? null,
        trade_license: p.trade_license ?? null,
        bin_vat: p.bin_vat ?? null,
        signature: p.show_signature ? (p.signature_url ?? null) : null,
        seal: p.show_seal ? (p.seal_url ?? null) : null,
      },
      footer: {
        thanks: p.thank_you_message ?? null,
        terms: p.show_terms === false ? null : (p.terms ?? null),
        refund: p.refund_policy ?? null,
      },
      display: {
        logo: p.show_logo ?? true,
        signature: !!p.show_signature,
        seal: !!p.show_seal,
        terms: p.show_terms ?? true,
      },
      order: {
        id: order.id,
        invoice_no: order.invoice_no ?? order.id.slice(0, 8).toUpperCase(),
        date: order.created_at,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        courier_name: order.courier_name ?? null,
        tracking_id: order.courier_tracking_id ?? null,
        tracking_url:
          (order.courier_code
            ? buildTrackingUrl(order.courier_code, order.courier_tracking_id, order.phone)
            : null) ?? `https://orzen.top/store/${store?.slug ?? ""}/order/${order.id}`,
        payment_url: null,
        note: order.notes ?? null,
      },
      customer: {
        name: order.customer_name,
        phone: order.phone,
        email: (order as any).email ?? null,
        address: order.address,
        area: order.area ?? null,
      },
      items: list,
      totals: { subtotal: itemsTotal, delivery, discount, total, paid, due: Math.max(total - paid, 0) },
      currency: "৳",
    };

    return { invoice, template, storeSlug: store?.slug ?? null };
  });

/** Email the invoice link to the customer (or any address). */
export const emailInvoiceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), to: z.string().email(), url: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) throw new Error("No store");
    const { data: order } = await sb
      .from("orders")
      .select("invoice_no,customer_name")
      .eq("id", data.orderId)
      .eq("store_id", sid)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const subject = `Your invoice ${order.invoice_no ?? ""}`.trim();
    const html = `<p>Hi ${order.customer_name ?? "there"},</p>
<p>Your invoice is ready. You can view or download it here:</p>
<p><a href="${data.url}">${data.url}</a></p>`;
    await enqueueEmail({ to: data.to, template: "invoice_link", subject, html, payload: { orderId: data.orderId, storeId: sid } });
    return { ok: true };
  });
