// Server-only digital fulfilment: entitlements, licenses, signed downloads.
// Never import this from a component — it uses the service-role client.
import type { SupabaseClient } from "@supabase/supabase-js";

type Sb = SupabaseClient<any, any, any>;

const BUCKET = "store-assets";

function randomKey() {
  const block = () =>
    Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, "X");
  return `${block()}-${block()}-${block()}-${block()}`;
}

export type DigitalRules = {
  mode?: "instant" | "manual";
  max_downloads?: number | null;
  expiry_days?: number | null;
  link_minutes?: number | null;
  max_devices?: number | null;
  max_ips?: number | null;
  max_activations?: number | null;
  require_login?: boolean;
  auto_email?: boolean;
  auto_invoice?: boolean;
};

function rulesOf(meta: any): DigitalRules {
  return (meta?.digital?.download ?? {}) as DigitalRules;
}

/**
 * Creates one entitlement row per digital line of an order.
 * Idempotent: existing rows for the order are left untouched.
 */
export async function grantDigitalAccess(sb: Sb, orderId: string) {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,customer_id,phone,payment_status,payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { created: 0 };

  const { data: items } = await sb
    .from("order_items")
    .select("product_id")
    .eq("order_id", orderId);
  const productIds = Array.from(new Set((items ?? []).map((i: any) => i.product_id).filter(Boolean)));
  if (!productIds.length) return { created: 0 };

  const { data: products } = await sb
    .from("products")
    .select("id,product_type,meta")
    .in("id", productIds)
    .eq("product_type", "digital");
  if (!products?.length) return { created: 0 };

  const { data: existing } = await sb
    .from("digital_entitlements")
    .select("product_id")
    .eq("order_id", orderId);
  const have = new Set((existing ?? []).map((e: any) => e.product_id));

  let created = 0;
  for (const p of products) {
    if (have.has(p.id)) continue;
    const rules = rulesOf(p.meta);
    const licenseType = (p.meta as any)?.digital?.license_type ?? "personal";

    const { data: lic } = await sb
      .from("digital_licenses")
      .insert({
        store_id: order.store_id,
        product_id: p.id,
        order_id: orderId,
        license_key: randomKey(),
        license_type: licenseType,
        max_activations: rules.max_activations ?? null,
      })
      .select("id")
      .single();

    const { error } = await sb.from("digital_entitlements").insert({
      store_id: order.store_id,
      order_id: orderId,
      product_id: p.id,
      customer_id: order.customer_id,
      customer_phone: order.phone,
      status: "locked",
      max_downloads: rules.max_downloads ?? null,
      max_devices: rules.max_devices ?? null,
      max_ips: rules.max_ips ?? null,
      version: (p.meta as any)?.digital?.version ?? null,
      license_id: lic?.id ?? null,
    });
    if (!error) created++;
  }
  return { created };
}

/**
 * Unlocks every entitlement of a paid order and stamps the expiry window.
 * Safe to call more than once.
 */
export async function activateDigitalAccess(sb: Sb, orderId: string) {
  await grantDigitalAccess(sb, orderId);
  const { data: rows } = await sb
    .from("digital_entitlements")
    .select("id,product_id,status")
    .eq("order_id", orderId);
  if (!rows?.length) return { activated: 0 };

  const productIds = rows.map((r: any) => r.product_id);
  const { data: products } = await sb
    .from("products")
    .select("id,meta")
    .in("id", productIds);
  const metaById = new Map((products ?? []).map((p: any) => [p.id, p.meta]));

  let activated = 0;
  for (const r of rows) {
    if (r.status === "revoked") continue;
    const rules = rulesOf(metaById.get(r.product_id));
    if (rules.mode === "manual" && r.status === "locked") continue;
    const expires =
      rules.expiry_days && rules.expiry_days > 0
        ? new Date(Date.now() + rules.expiry_days * 86400_000).toISOString()
        : null;
    const { error } = await sb
      .from("digital_entitlements")
      .update({ status: "active", expires_at: expires })
      .eq("id", r.id);
    if (!error) activated++;
  }
  return { activated };
}

/** Issues a short-lived signed URL for one file of an unlocked entitlement. */
export async function issueDownloadUrl(
  sb: Sb,
  opts: {
    entitlementId: string;
    fileIndex: number;
    ip?: string | null;
    deviceId?: string | null;
    userAgent?: string | null;
  },
) {
  const { data: ent } = await sb
    .from("digital_entitlements")
    .select("id,store_id,product_id,status,max_downloads,download_count,max_devices,max_ips,expires_at")
    .eq("id", opts.entitlementId)
    .maybeSingle();
  if (!ent) throw new Error("Download not found");
  if (ent.status !== "active") throw new Error("This download is not unlocked yet");
  if (ent.expires_at && new Date(ent.expires_at) < new Date())
    throw new Error("This download link has expired");
  if (ent.max_downloads != null && ent.download_count >= ent.max_downloads)
    throw new Error("Download limit reached");

  // Device / IP caps
  if (ent.max_devices != null || ent.max_ips != null) {
    const { data: log } = await sb
      .from("digital_downloads")
      .select("ip,device_id")
      .eq("entitlement_id", ent.id);
    if (ent.max_devices != null) {
      const devices = new Set((log ?? []).map((l: any) => l.device_id).filter(Boolean));
      if (opts.deviceId && !devices.has(opts.deviceId) && devices.size >= ent.max_devices)
        throw new Error("Maximum number of devices reached");
    }
    if (ent.max_ips != null) {
      const ips = new Set((log ?? []).map((l: any) => l.ip).filter(Boolean));
      if (opts.ip && !ips.has(opts.ip) && ips.size >= ent.max_ips)
        throw new Error("Maximum number of IP addresses reached");
    }
  }

  const { data: product } = await sb
    .from("products")
    .select("id,name,meta")
    .eq("id", ent.product_id)
    .maybeSingle();
  const dg = (product?.meta as any)?.digital ?? {};
  const files: any[] = Array.isArray(dg.files) ? dg.files : [];
  const external: string | null = dg.external_url ?? null;

  let url: string;
  let filePath: string | null = null;
  if (opts.fileIndex < 0 && external) {
    url = external;
  } else {
    const file = files[opts.fileIndex];
    if (!file?.path) throw new Error("File unavailable");
    filePath = file.path;
    const minutes = Number(dg.download?.link_minutes ?? 10);
    const { data: signed, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(file.path, Math.max(1, Math.min(minutes, 60)) * 60, { download: file.name });
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "Could not create download link");
    url = signed.signedUrl;
  }

  await sb.from("digital_downloads").insert({
    store_id: ent.store_id,
    entitlement_id: ent.id,
    file_path: filePath,
    ip: opts.ip ?? null,
    device_id: opts.deviceId ?? null,
    user_agent: opts.userAgent ?? null,
  });
  await sb
    .from("digital_entitlements")
    .update({ download_count: (ent.download_count ?? 0) + 1 })
    .eq("id", ent.id);

  return { url, name: files[opts.fileIndex]?.name ?? product?.name ?? "download" };
}
