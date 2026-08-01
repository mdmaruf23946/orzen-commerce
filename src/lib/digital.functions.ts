// Digital store server functions: owner file/license management + buyer downloads.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------------------------------------------------------------- owner side

async function ownerStore(context: any) {
  const { data: store } = await context.supabase
    .from("stores")
    .select("id,store_mode")
    .eq("owner_user_id", context.userId)
    .maybeSingle();
  if (!store) throw new Error("No store");
  return store as { id: string; store_mode: string };
}

export const listProductFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: rows, error } = await context.supabase
      .from("product_files")
      .select("*")
      .eq("store_id", store.id)
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveProductFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        productId: uuid,
        label: z.string().trim().min(1).max(160),
        version: z.string().trim().max(40).optional().nullable(),
        storage_path: z.string().trim().max(500).optional().nullable(),
        external_url: z.string().trim().max(1000).optional().nullable(),
        file_type: z.string().trim().max(120).optional().nullable(),
        file_size: z.number().int().nonnegative().optional().nullable(),
        sort_order: z.number().int().min(0).max(999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    if (!data.storage_path && !data.external_url) {
      throw new Error("Upload a file or provide an external link");
    }
    const row = {
      store_id: store.id,
      product_id: data.productId,
      label: data.label,
      version: data.version || null,
      storage_path: data.storage_path || null,
      external_url: data.external_url || null,
      file_type: data.file_type || null,
      file_size: data.file_size ?? null,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("product_files")
        .update(row as any)
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("product_files")
      .insert(row as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteProductFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: row } = await context.supabase
      .from("product_files")
      .select("storage_path")
      .eq("id", data.id)
      .eq("store_id", store.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("product_files")
      .delete()
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    if ((row as any)?.storage_path) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.from("digital-files").remove([(row as any).storage_path]);
      } catch {
        /* best effort */
      }
    }
    return { ok: true };
  });

export const updateProductDigital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        productId: uuid,
        product_type: z.enum(["physical", "digital", "service", "subscription"]),
        digital: z
          .object({
            delivery: z.enum(["instant", "manual"]),
            license_enabled: z.boolean(),
            download_limit: z.number().int().min(1).max(9999).nullable(),
            expiry_days: z.number().int().min(1).max(3650).nullable(),
            instructions: z.string().max(2000).nullable(),
          })
          .partial()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { error } = await context.supabase
      .from("products")
      .update({ product_type: data.product_type, digital: (data.digital ?? {}) as any } as any)
      .eq("id", data.productId)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Assign the product to one of the global digital categories. */
export const setProductDigitalCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ productId: uuid, key: z.string().trim().max(64).nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { error } = await context.supabase
      .from("products")
      .update({ digital_category: data.key || null } as any)
      .eq("id", data.productId)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Global digital category catalog, for admin pickers. */
export const listDigitalCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("platform_digital_categories")
      .select("key,name,sort_order,is_active,icon,description,id")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listLicenseKeys = createServerFn({ method: "GET" })

  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: rows, error } = await context.supabase
      .from("license_keys")
      .select("id,key_value,status,order_id,assigned_at,created_at")
      .eq("store_id", store.id)
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addLicenseKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ productId: uuid, keys: z.array(z.string().trim().min(3).max(200)).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const rows = Array.from(new Set(data.keys)).map((k) => ({
      store_id: store.id,
      product_id: data.productId,
      key_value: k,
      status: "available",
    }));
    const { error } = await context.supabase.from("license_keys").insert(rows as any);
    if (error) throw new Error(error.message);
    return { added: rows.length };
  });

export const deleteLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { error } = await context.supabase
      .from("license_keys")
      .delete()
      .eq("id", data.id)
      .eq("store_id", store.id)
      .eq("status", "available");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner preview link for one of their own stored files. */
export const signOwnerFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fileId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: row } = await context.supabase
      .from("product_files")
      .select("storage_path,external_url")
      .eq("id", data.fileId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("File not found");
    if ((row as any).external_url) return { url: (row as any).external_url };
    const { signDigitalFile } = await import("@/lib/digital.server");
    return { url: await signDigitalFile((row as any).storage_path) };
  });

/** Admin dashboard: every digital entitlement of the store. */
export const listStoreDownloads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownerStore(context);
    const { data: rows, error } = await context.supabase
      .from("order_downloads")
      .select(
        "id,order_id,product_name,file_label,version,status,download_count,max_downloads,expires_at,created_at",
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Manually release a locked entitlement (manual-delivery products). */
export const releaseOrderDownloads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: order } = await context.supabase
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const { fulfilDigitalOrder } = await import("@/lib/digital.server");
    return await fulfilDigitalOrder(data.orderId);
  });

// --------------------------------------------------------------- buyer side

/** Downloads attached to one order (buyer-facing, keyed by the order id). */
export const listOrderDownloads = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("order_downloads")
      .select(
        "id,product_id,product_name,file_label,version,status,download_count,max_downloads,expires_at",
      )
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });
    const list = rows ?? [];
    if (list.length === 0) return { downloads: [], licenses: [], instructions: [] as string[] };

    const { data: keys } = await supabaseAdmin
      .from("license_keys")
      .select("key_value,product_id")
      .eq("order_id", data.orderId);

    const productIds = Array.from(new Set(list.map((r: any) => r.product_id).filter(Boolean)));
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id,name,digital")
      .in("id", productIds as string[]);
    const instructions = (products ?? [])
      .map((p: any) => (p.digital?.instructions ? `${p.name}: ${p.digital.instructions}` : null))
      .filter(Boolean) as string[];

    return { downloads: list, licenses: keys ?? [], instructions };
  });

/** All purchases of a signed-in store customer. */
export const listMyDownloads = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ storeId: uuid, token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.rpc("customer_from_token", {
      _token: data.token,
      _store_id: data.storeId,
    } as any);
    if (!c) throw new Error("Not signed in");
    const customerId = (c as any).id as string;
    const { data: rows } = await supabaseAdmin
      .from("order_downloads")
      .select(
        "id,order_id,product_id,product_name,file_label,version,status,download_count,max_downloads,expires_at,created_at",
      )
      .eq("store_id", data.storeId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: keys } = await supabaseAdmin
      .from("license_keys")
      .select("key_value,product_id,order_id")
      .eq("store_id", data.storeId)
      .eq("customer_id", customerId);
    return { downloads: rows ?? [], licenses: keys ?? [] };
  });

/**
 * Issue a short-lived download URL. Enforces status, expiry and the per-file
 * download cap, then records the hit.
 */
export const requestDownload = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ downloadId: uuid, orderId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("order_downloads")
      .select("id,order_id,status,expires_at,download_count,max_downloads,product_file_id")
      .eq("id", data.downloadId)
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!row) throw new Error("Download not found");
    const r = row as any;
    if (r.status !== "active") throw new Error("This download is not unlocked yet");
    if (r.expires_at && new Date(r.expires_at) < new Date()) throw new Error("Download link expired");
    if (r.max_downloads != null && r.download_count >= r.max_downloads) {
      throw new Error("Download limit reached");
    }
    if (!r.product_file_id) throw new Error("No file attached — the seller will deliver it manually");

    const { data: file } = await supabaseAdmin
      .from("product_files")
      .select("storage_path,external_url")
      .eq("id", r.product_file_id)
      .maybeSingle();
    if (!file) throw new Error("File unavailable");

    let url: string;
    if ((file as any).external_url) {
      url = (file as any).external_url;
    } else {
      const { signDigitalFile } = await import("@/lib/digital.server");
      url = await signDigitalFile((file as any).storage_path);
    }

    await supabaseAdmin
      .from("order_downloads")
      .update({
        download_count: r.download_count + 1,
        last_downloaded_at: new Date().toISOString(),
      } as any)
      .eq("id", r.id);

    return { url };
  });

// ------------------------------------------------- admin download management

/** Reset the download counter of one entitlement back to zero. */
export const resetDownloadLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { error } = await context.supabase
      .from("order_downloads")
      .update({ download_count: 0, status: "active" } as any)
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Revoke (or restore) access to a single entitlement. */
export const setDownloadAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, status: z.enum(["active", "revoked"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { error } = await context.supabase
      .from("order_downloads")
      .update({ status: data.status } as any)
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Re-send the download email for an order. */
export const resendDownloadEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownerStore(context);
    const { data: order } = await context.supabase
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const { sendDownloadEmail } = await import("@/lib/digital.server");
    const sent = await sendDownloadEmail(data.orderId);
    if (!sent) throw new Error("No email address on this order");
    return { ok: true };
  });

/** Digital orders grouped for the admin dashboard. */
export const listDigitalOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownerStore(context);
    const { data: rows, error } = await context.supabase
      .from("order_downloads")
      .select(
        "id,order_id,product_id,product_name,file_label,version,status,download_count,max_downloads,expires_at,last_downloaded_at,created_at",
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const orderIds = Array.from(new Set(list.map((r: any) => r.order_id)));
    if (orderIds.length === 0) return { orders: [], storeMode: store.store_mode };

    const { data: orders } = await context.supabase
      .from("orders")
      .select("id,invoice_no,customer_name,phone,payment_status,status,subtotal,created_at")
      .in("id", orderIds as string[]);
    const byId = new Map((orders ?? []).map((o: any) => [o.id, o]));

    const grouped = orderIds.map((oid) => {
      const o: any = byId.get(oid as string) ?? {};
      const files = list.filter((r: any) => r.order_id === oid);
      return {
        order_id: oid as string,
        invoice_no: o.invoice_no ?? null,
        customer_name: o.customer_name ?? "—",
        phone: o.phone ?? null,
        payment_status: o.payment_status ?? "pending",
        status: o.status ?? "placed",
        subtotal: Number(o.subtotal ?? 0),
        created_at: o.created_at ?? files[0]?.created_at,
        files,
      };
    });
    return { orders: grouped, storeMode: store.store_mode };
  });

// -------------------------------------------------- Winner Admin: catalog CRUD

export const ownerUpsertDigitalCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        key: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
        name: z.string().trim().min(1).max(80),
        icon: z.string().trim().max(60).nullable().optional(),
        description: z.string().trim().max(300).nullable().optional(),
        sort_order: z.number().int().min(0).max(9999).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      key: data.key,
      name: data.name,
      icon: data.icon ?? null,
      description: data.description ?? null,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("platform_digital_categories")
        .update(row as any)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("platform_digital_categories")
      .insert(row as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const ownerDeleteDigitalCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("platform_digital_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** KPI snapshot for the Digital dashboard (owner only). */
export const digitalDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownerStore(context);
    const sb = context.supabase;

    const [{ data: products }, { data: downloads }, { data: licenses }, { data: orders }] =
      await Promise.all([
        sb
          .from("products")
          .select("id,name,price,status,updated_at,primary_image_url")
          .eq("store_id", store.id)
          .eq("product_type", "digital"),
        sb
          .from("order_downloads")
          .select("product_id,product_name,status,download_count,created_at")
          .eq("store_id", store.id),
        sb.from("license_keys").select("status").eq("store_id", store.id),
        sb
          .from("orders")
          .select("total,payment_status,is_digital,created_at")
          .eq("store_id", store.id)
          .eq("is_digital", true),
      ]);

    const prods = (products ?? []) as any[];
    const dls = (downloads ?? []) as any[];
    const lics = (licenses ?? []) as any[];
    const ords = (orders ?? []) as any[];

    const freeIds = new Set(prods.filter((p) => Number(p.price) === 0).map((p) => p.id));
    const byProduct = new Map<string, { name: string; count: number }>();
    for (const d of dls) {
      if (!d.product_id) continue;
      const cur = byProduct.get(d.product_id) ?? { name: d.product_name, count: 0 };
      cur.count += d.download_count ?? 0;
      byProduct.set(d.product_id, cur);
    }

    const paid = ords.filter((o) => o.payment_status === "paid");
    return {
      totals: {
        products: prods.length,
        published: prods.filter((p) => p.status === "active" || p.status === "published").length,
        downloads: dls.reduce((a, d) => a + (d.download_count ?? 0), 0),
        freeDownloads: dls
          .filter((d) => freeIds.has(d.product_id))
          .reduce((a, d) => a + (d.download_count ?? 0), 0),
        orders: ords.length,
        revenue: paid.reduce((a, o) => a + Number(o.total ?? 0), 0),
        activeLicenses: lics.filter((l) => l.status === "assigned").length,
        availableLicenses: lics.filter((l) => l.status === "available").length,
        lockedFiles: dls.filter((d) => d.status === "locked").length,
      },
      mostDownloaded: Array.from(byProduct.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      recentlyUpdated: prods
        .slice()
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, 6)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          updated_at: p.updated_at,
          image: p.primary_image_url,
        })),
    };
  });
