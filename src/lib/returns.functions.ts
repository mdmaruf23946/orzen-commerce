// Customer-initiated return / exchange requests.
// Shoppers are not Supabase-authenticated: they carry a store customer token,
// which is validated inside security-definer database functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  computeReturnAmounts,
  normalizePolicy,
  type ReturnKind,
  type ReturnLine,
} from "@/lib/returns-pricing";

const slugSchema = z.string().min(1).max(120);
const tokenSchema = z.string().min(16).max(128);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveStore(slug: string) {
  const sb = await admin();
  const { data } = await sb.from("stores").select("id,status").eq("slug", slug).maybeSingle();
  if (!data || (data as any).status !== "active") throw new Error("Store unavailable");
  return (data as any).id as string;
}

function firstImage(p: any): string | null {
  if (!p) return null;
  return p.primary_image_url ?? (Array.isArray(p.gallery) ? (p.gallery[0] ?? null) : null);
}

/** Variant list normalised to { label, price_delta, stock }. */
function variantOptions(product: any, basePrice: number) {
  const raw = Array.isArray(product?.variants) ? product.variants : [];
  const out: { label: string; price: number; stock: number }[] = [];
  for (const v of raw) {
    if (!v) continue;
    if (typeof v === "string") {
      out.push({ label: v, price: basePrice, stock: Number(product?.stock ?? 0) });
      continue;
    }
    const label =
      v.label ?? v.name ?? v.value ?? [v.option, v.title].filter(Boolean).join(" ") ?? "";
    if (Array.isArray(v.options ?? v.values)) {
      for (const o of v.options ?? v.values) {
        const oLabel = typeof o === "string" ? o : (o?.label ?? o?.value ?? "");
        if (!oLabel) continue;
        out.push({
          label: label ? `${label}: ${oLabel}` : String(oLabel),
          price: Number((typeof o === "object" && (o?.price ?? o?.amount)) ?? basePrice) || basePrice,
          stock: Number((typeof o === "object" && (o?.stock ?? o?.qty)) ?? product?.stock ?? 0),
        });
      }
      continue;
    }
    if (!label) continue;
    out.push({
      label: String(label),
      price: Number(v.price ?? basePrice) || basePrice,
      stock: Number(v.stock ?? product?.stock ?? 0),
    });
  }
  return out.filter((v) => v.stock > 0 || v.stock === 0);
}

/**
 * Everything the return wizard needs: policy, eligibility, the order lines with
 * how many units are still returnable, and the in-stock catalogue for exchanges.
 */
export const getReturnContext = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ storeSlug: slugSchema, token: tokenSchema, orderId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();

    const { data: cust } = await sb.rpc("customer_from_token" as any, {
      _token: data.token,
      _store_id: storeId,
    } as any);
    const customerId = (cust as any)?.id as string | undefined;
    if (!customerId) throw new Error("Please sign in");

    const { data: order } = await sb
      .from("orders")
      .select("id,status,order_type,created_at,payment_method,payment_status,delivery_amount")
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const [{ data: policyRaw }, { data: timeline }, { data: items }, { data: existing }] =
      await Promise.all([
        sb.rpc("get_public_return_settings" as any, { _store_id: storeId } as any),
        sb
          .from("order_timeline")
          .select("stage,created_at")
          .eq("order_id", data.orderId)
          .order("created_at"),
        sb
          .from("order_items")
          .select(
            "id,product_id,name_snapshot,price_snapshot,qty, products(id,name,price,stock,status,product_type,variants,primary_image_url,gallery)",
          )
          .eq("order_id", data.orderId),
        sb
          .from("returns")
          .select("id,status")
          .eq("order_id", data.orderId),
      ]);

    const policy = normalizePolicy(policyRaw);
    const delivered = (timeline ?? []).find((t: any) => t.stage === "delivered");
    const deliveredAt = delivered ? new Date((delivered as any).created_at).getTime() : null;
    const withinWindow = deliveredAt
      ? Date.now() - deliveredAt <= policy.eligibility_days * 86_400_000
      : false;
    const openRequest = ((existing ?? []) as any[]).some(
      (r) => !["rejected", "completed", "cancelled", "refunded"].includes(r.status),
    );

    // Units already claimed on earlier requests.
    const { data: claimed } = await sb
      .from("return_items")
      .select("order_item_id,qty, returns!inner(order_id,status)")
      .eq("returns.order_id", data.orderId);
    const usedByItem = new Map<string, number>();
    for (const c of ((claimed ?? []) as any[])) {
      if ((c.returns?.status ?? "") === "rejected" || (c.returns?.status ?? "") === "cancelled") continue;
      if (!c.order_item_id) continue;
      usedByItem.set(c.order_item_id, (usedByItem.get(c.order_item_id) ?? 0) + Number(c.qty ?? 0));
    }

    const lines = ((items ?? []) as any[]).map((it) => {
      const p = it.products;
      return {
        order_item_id: it.id as string,
        product_id: it.product_id as string | null,
        name: it.name_snapshot as string,
        price: Number(it.price_snapshot ?? 0),
        qty: Number(it.qty ?? 1),
        returnable_qty: Math.max(0, Number(it.qty ?? 1) - (usedByItem.get(it.id) ?? 0)),
        image_url: firstImage(p),
        variants: p ? variantOptions(p, Number(p.price ?? it.price_snapshot ?? 0)) : [],
        in_stock: Number(p?.stock ?? 0),
      };
    });

    let catalogue: any[] = [];
    if (policy.allow_exchange_other && policy.replacement_source !== "cart") {
      const { data: prods } = await sb
        .from("products")
        .select("id,name,price,stock,variants,primary_image_url,gallery,product_type,status")
        .eq("store_id", storeId)
        .eq("product_type", "physical")
        .eq("status", "active")
        .gt("stock", 0)
        .order("name")
        .limit(200);
      catalogue = ((prods ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price ?? 0),
        stock: Number(p.stock ?? 0),
        image_url: firstImage(p),
        variants: variantOptions(p, Number(p.price ?? 0)),
      }));
    }

    const eligible =
      policy.enabled &&
      (order as any).order_type === "physical" &&
      (order as any).status !== "cancelled" &&
      !!delivered &&
      withinWindow &&
      !openRequest &&
      lines.some((l) => l.returnable_qty > 0);

    return {
      policy,
      eligible,
      openRequest,
      deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : null,
      windowEndsAt: deliveredAt
        ? new Date(deliveredAt + policy.eligibility_days * 86_400_000).toISOString()
        : null,
      lines,
      catalogue,
      paymentMethod: (order as any).payment_method,
      paymentStatus: (order as any).payment_status,
    };
  });

const lineSchema = z.object({
  order_item_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().max(200),
  variant: z.string().max(120).nullable().optional(),
  qty: z.number().int().min(1).max(999),
  price: z.number().nonnegative().optional(),
  image_url: z.string().max(500).nullable().optional(),
});

const createArgs = z.object({
  storeSlug: slugSchema,
  token: tokenSchema,
  orderId: z.string().uuid(),
  kind: z.enum(["return", "exchange_same", "exchange_other"]),
  reason: z.string().trim().min(3).max(600),
  note: z.string().trim().max(600).optional(),
  lines: z.array(lineSchema).min(1).max(30),
  replacements: z.array(lineSchema).max(30).default([]),
  // Data URLs (image/*), max 4, compressed client-side.
  images: z.array(z.string().max(3_000_000)).max(4).default([]),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const createMyReturnRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => createArgs.parse(d))
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();

    // --- Ownership first: never read order lines or accept uploads for an
    // order that does not belong to the caller's session. ---
    const { data: cust } = await sb.rpc("customer_from_token" as any, {
      _token: data.token,
      _store_id: storeId,
    } as any);
    const customerId = (cust as any)?.id as string | undefined;
    if (!customerId) throw new Error("Please sign in");
    const { data: ownOrder } = await sb
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!ownOrder) throw new Error("Order not found");

    // --- Re-validate the requested lines against the real order ---
    const { data: items } = await sb
      .from("order_items")
      .select("id,product_id,name_snapshot,price_snapshot,qty")
      .eq("order_id", data.orderId);

    const byId = new Map(((items ?? []) as any[]).map((i) => [i.id, i]));
    const lines: ReturnLine[] = [];
    for (const l of data.lines) {
      const src = l.order_item_id ? byId.get(l.order_item_id) : null;
      if (!src) throw new Error("Invalid item in request");
      lines.push({
        order_item_id: src.id,
        product_id: src.product_id,
        name: src.name_snapshot,
        variant: l.variant ?? null,
        qty: Math.min(Number(l.qty), Number(src.qty ?? 1)),
        price: Number(src.price_snapshot ?? 0),
        image_url: l.image_url ?? null,
      });
    }

    // --- Re-price replacements from the catalogue ---
    const replacements: ReturnLine[] = [];
    if (data.kind !== "return") {
      for (const r of data.replacements) {
        if (!r.product_id) continue;
        const { data: p } = await sb
          .from("products")
          .select("id,name,price,stock,status,store_id")
          .eq("id", r.product_id)
          .eq("store_id", storeId)
          .maybeSingle();
        if (!p || (p as any).status === "draft") throw new Error("Replacement product unavailable");
        if (Number((p as any).stock ?? 0) < Number(r.qty)) throw new Error("Replacement out of stock");
        replacements.push({
          product_id: (p as any).id,
          name: (p as any).name,
          variant: r.variant ?? null,
          qty: Number(r.qty),
          price: Number((p as any).price ?? 0),
          image_url: r.image_url ?? null,
        });
      }
      if (replacements.length === 0) throw new Error("Pick a replacement item");
    }

    const { data: policyRaw } = await sb.rpc("get_public_return_settings" as any, {
      _store_id: storeId,
    } as any);
    const policy = normalizePolicy(policyRaw);
    if (!policy.enabled) throw new Error("Returns & exchanges are currently unavailable");
    if (policy.require_photo && data.images.length === 0)
      throw new Error("Please attach at least one photo of the product");
    const amounts = computeReturnAmounts(policy, data.kind as ReturnKind, lines, replacements);


    // --- Evidence photos ---
    const paths: string[] = [];
    for (const dataUrl of data.images) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
      if (!m) continue;
      const mime = m[1]!;
      const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 2 * 1024 * 1024) continue;
      const path = `returns/${storeId}/${data.orderId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${EXT[mime] ?? "jpg"}`;
      const { error } = await sb.storage.from("store-assets").upload(path, bytes, {
        contentType: mime,
        upsert: false,
      });
      if (!error) paths.push(path);
    }

    const { data: res, error } = await sb.rpc("customer_create_return_v2" as any, {
      _token: data.token,
      _store_id: storeId,
      _order_id: data.orderId,
      _kind: data.kind,
      _type: data.kind === "return" ? "return" : "exchange",
      _reason: data.reason,
      _note: data.note ?? null,
      _lines: lines as any,
      _replacement_items: replacements as any,
      _images: paths,
      _amounts: amounts as any,
    } as any);

    if (error) throw new Error(error.message);
    const out = res as any;
    if (out?.error) throw new Error(out.error);
    return { id: out?.id as string, amounts };
  });

export const listMyOrderReturns = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeSlug: slugSchema,
        token: tokenSchema,
        orderId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const storeId = await resolveStore(data.storeSlug);
    const sb = await admin();
    const { data: rows, error } = await sb.rpc("customer_list_returns_v2" as any, {
      _token: data.token,
      _store_id: storeId,
      _order_id: data.orderId ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return (rows as any[]) ?? [];
  });
