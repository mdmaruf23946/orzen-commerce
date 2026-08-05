// Customer-initiated return / exchange requests.
// Shoppers are not Supabase-authenticated: they carry a store customer token,
// which is validated inside security-definer database functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const itemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().max(200),
  qty: z.number().int().min(1).max(999),
  price: z.number().nonnegative().optional(),
});

const createArgs = z.object({
  storeSlug: slugSchema,
  token: tokenSchema,
  orderId: z.string().uuid(),
  type: z.enum(["return", "exchange"]),
  reason: z.string().trim().min(3).max(600),
  items: z.array(itemSchema).max(30).default([]),
  replacementNote: z.string().trim().max(400).optional(),
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

    // Upload evidence photos into the public-image namespace of store-assets.
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

    const { data: res, error } = await sb.rpc("customer_create_return", {
      _token: data.token,
      _store_id: storeId,
      _order_id: data.orderId,
      _type: data.type,
      _reason: data.reason,
      _items: data.items as any,
      _images: paths,
      _replacement_note: data.replacementNote ?? null,
    } as any);
    if (error) throw new Error(error.message);
    const out = res as any;
    if (out?.error) throw new Error(out.error);
    return { id: out?.id as string };
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
    const { data: rows, error } = await sb.rpc("customer_list_returns", {
      _token: data.token,
      _store_id: storeId,
      _order_id: data.orderId ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return (rows as any[]) ?? [];
  });
