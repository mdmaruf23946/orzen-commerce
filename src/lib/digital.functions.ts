// Customer-facing digital purchase + download endpoints.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

function clientIp(): string | null {
  try {
    const fwd = getRequestHeader("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return getRequestHeader("cf-connecting-ip") ?? null;
  } catch {
    return null;
  }
}

function userAgent(): string | null {
  try {
    return getRequestHeader("user-agent") ?? null;
  } catch {
    return null;
  }
}

type PublicFile = { index: number; name: string; size: number };

function publicFiles(meta: any): PublicFile[] {
  const files: any[] = Array.isArray(meta?.digital?.files) ? meta.digital.files : [];
  return files.map((f, index) => ({
    index,
    name: String(f?.name ?? `file-${index + 1}`),
    size: Number(f?.size ?? 0),
  }));
}

/** Every digital item a signed-in customer has bought from this store. */
export const listMyDigitalPurchases = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), token: z.string().min(16).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: c } = await sb.rpc("customer_from_token", {
      _token: data.token,
      _store_id: data.storeId,
    } as any);
    const customerId = (c as any)?.id;
    if (!customerId) return [];

    const { data: rows } = await sb
      .from("digital_entitlements")
      .select(
        "id,order_id,product_id,status,max_downloads,download_count,expires_at,version,created_at,license_id",
      )
      .eq("store_id", data.storeId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (!rows?.length) return [];

    const productIds = Array.from(new Set(rows.map((r: any) => r.product_id)));
    const licenseIds = rows.map((r: any) => r.license_id).filter(Boolean);
    const [{ data: products }, { data: licenses }] = await Promise.all([
      sb.from("products").select("id,name,primary_image_url,meta").in("id", productIds),
      licenseIds.length
        ? sb.from("digital_licenses").select("id,license_key,license_type,max_activations,activation_count").in("id", licenseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pById = new Map((products ?? []).map((p: any) => [p.id, p]));
    const lById = new Map((licenses ?? []).map((l: any) => [l.id, l]));

    return rows.map((r: any) => {
      const p = pById.get(r.product_id);
      const meta = p?.meta ?? {};
      const lic = r.license_id ? lById.get(r.license_id) : null;
      return {
        id: r.id,
        orderId: r.order_id,
        productId: r.product_id,
        name: p?.name ?? "Product",
        image: p?.primary_image_url
          ? p.primary_image_url.startsWith("http")
            ? p.primary_image_url
            : `/api/img/${p.primary_image_url}`
          : null,
        status: r.status as string,
        purchasedAt: r.created_at as string,
        downloadCount: r.download_count as number,
        maxDownloads: r.max_downloads as number | null,
        expiresAt: r.expires_at as string | null,
        version: (meta?.digital?.version ?? r.version) as string | null,
        changelog: (meta?.digital?.changelog ?? null) as string | null,
        files: publicFiles(meta),
        hasExternal: !!meta?.digital?.external_url,
        license: lic
          ? {
              key: lic.license_key as string,
              type: lic.license_type as string,
              activations: lic.activation_count as number,
              maxActivations: lic.max_activations as number | null,
            }
          : null,
      };
    });
  });

/**
 * Proof of ownership for an order. An order id alone is NOT enough: it is a
 * plain primary key that leaks through links, logs and analytics. The caller
 * must additionally present either a customer session token belonging to the
 * order's customer, or the contact (phone/email) used on the order.
 */
async function ownsOrder(
  sb: any,
  orderId: string,
  proof: { storeId?: string; token?: string; contact?: string },
): Promise<boolean> {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,customer_id,phone,email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;

  if (proof.token) {
    const { data: c } = await sb.rpc("customer_from_token", {
      _token: proof.token,
      _store_id: proof.storeId ?? order.store_id,
    } as any);
    const cid = (c as any)?.id;
    if (cid && order.customer_id && cid === order.customer_id) return true;
  }

  const contact = (proof.contact ?? "").trim().toLowerCase();
  if (contact) {
    const orderEmail = String(order.email ?? "").trim().toLowerCase();
    if (orderEmail && orderEmail === contact) return true;
    const digits = (v: string) => v.replace(/\D/g, "");
    const orderPhone = digits(String(order.phone ?? ""));
    const given = digits(contact);
    if (orderPhone && given.length >= 6 && (orderPhone === given || orderPhone.endsWith(given))) {
      return true;
    }
  }
  return false;
}

/**
 * Digital items attached to a single order. Metadata (status, counts) is
 * returned for the order page timeline, but license keys are only released
 * once ownership is proven.
 */
export const getOrderDigitalAccess = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        storeId: z.string().uuid().optional(),
        token: z.string().min(16).max(128).optional(),
        contact: z.string().trim().max(160).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await sb
      .from("digital_entitlements")
      .select("id,product_id,status,max_downloads,download_count,expires_at,version,license_id")
      .eq("order_id", data.orderId);
    if (!rows?.length) return [];

    const verified = await ownsOrder(sb, data.orderId, {
      storeId: data.storeId,
      token: data.token,
      contact: data.contact,
    });

    const productIds = Array.from(new Set(rows.map((r: any) => r.product_id)));
    const licenseIds = verified ? rows.map((r: any) => r.license_id).filter(Boolean) : [];
    const [{ data: products }, { data: licenses }] = await Promise.all([
      sb.from("products").select("id,name,primary_image_url,meta").in("id", productIds),
      licenseIds.length
        ? sb.from("digital_licenses").select("id,license_key,license_type").in("id", licenseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pById = new Map((products ?? []).map((p: any) => [p.id, p]));
    const lById = new Map((licenses ?? []).map((l: any) => [l.id, l]));

    return rows.map((r: any) => {
      const p = pById.get(r.product_id);
      const meta = p?.meta ?? {};
      const lic = verified && r.license_id ? lById.get(r.license_id) : null;
      return {
        id: r.id,
        productId: r.product_id,
        name: p?.name ?? "Product",
        status: r.status as string,
        verified,
        downloadCount: r.download_count as number,
        maxDownloads: r.max_downloads as number | null,
        expiresAt: r.expires_at as string | null,
        version: (meta?.digital?.version ?? r.version) as string | null,
        files: publicFiles(meta),
        hasExternal: !!meta?.digital?.external_url,
        license: lic ? { key: lic.license_key as string, type: lic.license_type as string } : null,
      };
    });
  });

/**
 * Issues a short-lived signed download link. The caller must prove access
 * with a customer session token for the customer who owns the entitlement,
 * or with the contact (phone/email) used on the originating order.
 */
export const requestDigitalDownload = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        entitlementId: z.string().uuid(),
        fileIndex: z.number().int().min(-1).max(50),
        orderId: z.string().uuid().optional(),
        storeId: z.string().uuid().optional(),
        token: z.string().min(16).max(128).optional(),
        contact: z.string().trim().max(160).optional(),
        deviceId: z.string().trim().max(128).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: ent } = await sb
      .from("digital_entitlements")
      .select("id,order_id,customer_id,store_id")
      .eq("id", data.entitlementId)
      .maybeSingle();
    if (!ent) throw new Error("Download not found");

    let allowed = false;
    if (data.token && data.storeId) {
      const { data: c } = await sb.rpc("customer_from_token", {
        _token: data.token,
        _store_id: data.storeId,
      } as any);
      if ((c as any)?.id && (c as any).id === ent.customer_id) allowed = true;
    }
    if (!allowed && ent.order_id) {
      allowed = await ownsOrder(sb, ent.order_id, {
        storeId: data.storeId ?? ent.store_id,
        token: data.token,
        contact: data.contact,
      });
    }
    if (!allowed) throw new Error("You do not have access to this download");

    const { issueDownloadUrl } = await import("@/lib/digital.server");
    return issueDownloadUrl(sb as any, {
      entitlementId: ent.id,
      fileIndex: data.fileIndex,
      ip: clientIp(),
      deviceId: data.deviceId ?? null,
      userAgent: userAgent(),
    });
  });

