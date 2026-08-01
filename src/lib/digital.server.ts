// Server-only digital fulfilment engine: entitlements, unlocking, license keys.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeDigital } from "@/lib/digital";

type SB = typeof supabaseAdmin;

export const DIGITAL_BUCKET = "digital-files";

/**
 * Create (idempotently) the download entitlements for every digital line item
 * of an order. Rows start life as `locked` and are released by
 * {@link unlockOrderDownloads} once the order is paid / approved.
 */
export async function createEntitlementsForOrder(orderId: string, sb: SB = supabaseAdmin) {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,customer_id,phone")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { created: 0, digital: false };

  const { data: existing } = await sb
    .from("order_downloads")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existing && existing.length > 0) return { created: 0, digital: true };

  const { data: items } = await sb
    .from("order_items")
    .select("product_id,name_snapshot")
    .eq("order_id", orderId);
  const ids = (items ?? []).map((i) => i.product_id).filter(Boolean) as string[];
  if (ids.length === 0) return { created: 0, digital: false };

  const { data: products } = await sb
    .from("products")
    .select("id,name,product_type,digital")
    .in("id", ids);
  const digitalProducts = (products ?? []).filter((p: any) => p.product_type === "digital");
  if (digitalProducts.length === 0) return { created: 0, digital: false };

  const { data: files } = await sb
    .from("product_files")
    .select("id,product_id,label,version,storage_path,external_url,sort_order")
    .in(
      "product_id",
      digitalProducts.map((p: any) => p.id),
    )
    .order("sort_order", { ascending: true });

  const rows: any[] = [];
  for (const p of digitalProducts as any[]) {
    const cfg = normalizeDigital(p.digital);
    const own = (files ?? []).filter((f: any) => f.product_id === p.id);
    const base = {
      order_id: orderId,
      store_id: (order as any).store_id,
      customer_id: (order as any).customer_id ?? null,
      product_id: p.id,
      product_name: p.name,
      status: "locked",
      max_downloads: cfg.download_limit,
    };
    if (own.length === 0) {
      // License-only / manually delivered product: still create a placeholder row
      // so the buyer sees the purchase in "My Downloads".
      rows.push({ ...base, product_file_id: null, file_label: null, version: null });
    } else {
      for (const f of own) {
        rows.push({
          ...base,
          product_file_id: f.id,
          file_label: f.label,
          version: f.version ?? null,
        });
      }
    }
  }

  if (rows.length === 0) return { created: 0, digital: true };
  const { error } = await sb.from("order_downloads").insert(rows as any);
  if (error) throw new Error(error.message);
  await sb.from("orders").update({ is_digital: true } as any).eq("id", orderId);
  return { created: rows.length, digital: true };
}

/**
 * Release every locked entitlement of an order and assign license keys where the
 * product requires them. Safe to call multiple times.
 */
export async function unlockOrderDownloads(orderId: string, sb: SB = supabaseAdmin) {
  const { data: rows } = await sb
    .from("order_downloads")
    .select("id,product_id,store_id,customer_id,status")
    .eq("order_id", orderId);
  if (!rows || rows.length === 0) return { unlocked: 0, licenses: 0 };

  const productIds = Array.from(new Set(rows.map((r: any) => r.product_id).filter(Boolean)));
  const { data: products } = await sb
    .from("products")
    .select("id,digital")
    .in("id", productIds as string[]);
  const cfgById = new Map(
    (products ?? []).map((p: any) => [p.id, normalizeDigital(p.digital)] as const),
  );

  let unlocked = 0;
  for (const r of rows as any[]) {
    if (r.status !== "locked") continue;
    const cfg = cfgById.get(r.product_id);
    const expires =
      cfg?.expiry_days != null
        ? new Date(Date.now() + cfg.expiry_days * 86400_000).toISOString()
        : null;
    const { error } = await sb
      .from("order_downloads")
      .update({ status: "active", expires_at: expires } as any)
      .eq("id", r.id);
    if (!error) unlocked++;
  }

  // Assign one license key per digital product that requires one.
  let licenses = 0;
  for (const pid of productIds as string[]) {
    const cfg = cfgById.get(pid);
    if (!cfg?.license_enabled) continue;
    const { data: already } = await sb
      .from("license_keys")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", pid)
      .limit(1);
    if (already && already.length > 0) continue;
    const row: any = rows.find((r: any) => r.product_id === pid);
    const { data: free } = await sb
      .from("license_keys")
      .select("id")
      .eq("product_id", pid)
      .eq("status", "available")
      .is("order_id", null)
      .limit(1)
      .maybeSingle();
    if (!free) continue;
    const { error } = await sb
      .from("license_keys")
      .update({
        status: "assigned",
        order_id: orderId,
        customer_id: row?.customer_id ?? null,
        assigned_at: new Date().toISOString(),
      } as any)
      .eq("id", (free as any).id)
      .eq("status", "available");
    if (!error) licenses++;
  }

  return { unlocked, licenses };
}

/** Public origin used for links inside delivery emails. */
function publicOrigin() {
  return (
    process.env["PUBLIC_APP_URL"] ||
    process.env["VITE_APP_URL"] ||
    "https://orzen-commerce.lovable.app"
  ).replace(/\/$/, "");
}

/**
 * Send the "your download is ready" email for an order. Safe to call again
 * (admin "resend" action). Returns false when there is no recipient address.
 */
export async function sendDownloadEmail(orderId: string, sb: SB = supabaseAdmin) {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,customer_id,customer_name,invoice_no")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  const o = order as any;

  const { data: rows } = await sb
    .from("order_downloads")
    .select("product_id,product_name,file_label,version,status")
    .eq("order_id", orderId);
  const active = (rows ?? []).filter((r: any) => r.status === "active");
  if (active.length === 0) return false;

  let email: string | null = null;
  let name: string | null = o.customer_name ?? null;
  if (o.customer_id) {
    const { data: c } = await sb
      .from("store_customers")
      .select("email,full_name")
      .eq("id", o.customer_id)
      .maybeSingle();
    email = (c as any)?.email ?? null;
    name = (c as any)?.full_name ?? name;
  }
  if (!email) return false;

  const [{ data: store }, { data: keys }, { data: products }] = await Promise.all([
    sb.from("stores").select("name,slug").eq("id", o.store_id).maybeSingle(),
    sb.from("license_keys").select("key_value").eq("order_id", orderId),
    sb
      .from("products")
      .select("id,digital")
      .in("id", Array.from(new Set(active.map((r: any) => r.product_id).filter(Boolean))) as string[]),
  ]);

  const instructions = (products ?? [])
    .map((p: any) => (p.digital?.instructions ? String(p.digital.instructions) : null))
    .filter(Boolean) as string[];

  const { tplDigitalDownloadReady, enqueueEmail } = await import("@/lib/emails.server");
  const tpl = tplDigitalDownloadReady({
    storeName: (store as any)?.name ?? "Store",
    customerName: name,
    orderRef: o.invoice_no || String(o.id).slice(0, 8).toUpperCase(),
    downloadUrl: `${publicOrigin()}/store/${(store as any)?.slug ?? ""}/order/${orderId}`,
    items: active.map((r: any) => ({
      name: r.product_name,
      label: r.file_label,
      version: r.version,
    })),
    licenses: (keys ?? []).map((k: any) => k.key_value),
    instructions,
  });
  await enqueueEmail({
    to: email,
    template: "digital_download_ready",
    subject: tpl.subject,
    html: tpl.html,
    payload: { order_id: orderId },
  });
  return true;
}

/**
 * Called from every place that flips an order to paid / fulfilled. Creates the
 * entitlements if missing, then unlocks them and emails the buyer. Never throws.
 */
export async function fulfilDigitalOrder(orderId: string) {
  try {
    await createEntitlementsForOrder(orderId);
    const res = await unlockOrderDownloads(orderId);
    if (res.unlocked > 0) {
      await sendDownloadEmail(orderId).catch(() => false);
    }
    return res;
  } catch (e) {
    console.error("[digital] fulfilment failed:", (e as Error).message);
    return { unlocked: 0, licenses: 0 };
  }
}

/** Signed URL for a stored digital file (private bucket). */
export async function signDigitalFile(path: string, seconds = 300, sb: SB = supabaseAdmin) {
  const { data, error } = await sb.storage.from(DIGITAL_BUCKET).createSignedUrl(path, seconds, {
    download: true,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not create download link");
  return data.signedUrl;
}
