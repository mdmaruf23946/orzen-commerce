// Server-only: catalog sync from connected websites + outbound order status pushes.
import { z } from "zod";
import {
  decryptWebhookSecret, hashApiKey, hmacSign, verifyHmac, verifyTimestamp,
} from "@/lib/landing-pages.server";
import { assertSafeOutboundUrl } from "@/lib/external-sites";

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;

const str = (n: number) => z.union([z.string(), z.number()]).transform((v) => String(v).trim().slice(0, n));
const num = z.union([z.number(), z.string()]).transform((v) => Number(v)).refine((v) => Number.isFinite(v));

const CatalogSchema = z.object({
  contact: z.object({
    name: str(200).optional(), phone: str(60).optional(), email: str(200).optional(),
    address: str(500).optional(), website: str(500).optional(),
  }).partial().optional(),
  categories: z.array(z.object({
    external_id: str(120), name: str(200),
    parent_external_id: str(120).nullable().optional(), image_url: str(1000).nullable().optional(),
  })).max(2000).default([]),
  products: z.array(z.object({
    external_id: str(120), name: str(300), sku: str(120).nullable().optional(),
    price: num, sale_price: num.nullable().optional(), stock: num.nullable().optional(),
    description: str(5000).nullable().optional(), image_url: str(1000).nullable().optional(),
    product_url: str(1000).nullable().optional(), category_external_id: str(120).nullable().optional(),
    variants: z.array(z.record(z.string(), z.any())).max(200).optional(),
    status: z.enum(["active", "draft", "out_of_stock"]).optional(),
  })).max(5000).default([]),
  deleted_product_ids: z.array(str(120)).max(5000).default([]),
  deleted_category_ids: z.array(str(120)).max(2000).default([]),
  /** true = full catalog; anything not in this payload is removed. */
  replace: z.boolean().default(false),
});

type Res = { status: number; body: Record<string, unknown> };

async function authConnection(sb: any, connectionId: string, rawBody: string, h: Headers) {
  const { data: conn } = await sb.from("landing_page_connections")
    .select("id,store_id,status").eq("id", connectionId).maybeSingle();
  if (!conn) return { err: { status: 404, body: { ok: false, error: "Connection not found" } } as Res };
  if (conn.status !== "active") return { err: { status: 403, body: { ok: false, error: "Connection is paused" } } as Res };
  const { data: creds } = await sb.from("landing_page_credentials")
    .select("webhook_secret_enc,api_key_hash").eq("connection_id", conn.id).maybeSingle();
  const apiKey = (h.get("x-api-key") ?? h.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let ok = false;
  if (apiKey && creds?.api_key_hash) ok = hashApiKey(apiKey) === creds.api_key_hash;
  if (!ok && h.get("x-signature")) {
    const secret = creds?.webhook_secret_enc ? decryptWebhookSecret(creds.webhook_secret_enc) : "";
    ok = !!secret && verifyTimestamp(h.get("x-timestamp")) && verifyHmac(secret, rawBody, h.get("x-signature"));
  }
  if (!ok) return { err: { status: 401, body: { ok: false, error: "Unauthorized" } } as Res };
  return { conn: conn as { id: string; store_id: string } };
}

export async function syncCatalog(connectionId: string, rawBody: string, headers: Headers): Promise<Res> {
  if (rawBody.length > MAX_CATALOG_BYTES) return { status: 413, body: { ok: false, error: "Payload too large (max 2MB per request)" } };
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const a = await authConnection(sb, connectionId, rawBody, headers);
  if ("err" in a) return a.err!;
  const conn = a.conn;
  let parsed;
  try {
    parsed = CatalogSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    return { status: 422, body: { ok: false, error: "Invalid catalog payload", detail: String((e as Error).message).slice(0, 400) } };
  }
  const now = new Date().toISOString();
  const base = { store_id: conn.store_id, connection_id: conn.id, updated_at: now };

  if (parsed.categories.length) {
    const { error } = await sb.from("external_site_categories").upsert(
      parsed.categories.map((c) => ({ ...base, external_id: c.external_id, name: c.name, parent_external_id: c.parent_external_id ?? null, image_url: c.image_url ?? null })),
      { onConflict: "connection_id,external_id" },
    );
    if (error) return { status: 500, body: { ok: false, error: error.message } };
  }
  for (let i = 0; i < parsed.products.length; i += 500) {
    const chunk = parsed.products.slice(i, i + 500).map((p) => ({
      ...base, external_id: p.external_id, name: p.name, sku: p.sku ?? null,
      price: p.price, sale_price: p.sale_price ?? null,
      stock: p.stock == null ? null : Math.max(0, Math.floor(p.stock)),
      description: p.description ?? null, image_url: p.image_url ?? null, product_url: p.product_url ?? null,
      category_external_id: p.category_external_id ?? null, variants: p.variants ?? [],
      status: p.status ?? (p.stock != null && p.stock <= 0 ? "out_of_stock" : "active"),
    }));
    const { error } = await sb.from("external_site_products").upsert(chunk, { onConflict: "connection_id,external_id" });
    if (error) return { status: 500, body: { ok: false, error: error.message } };
  }
  if (parsed.deleted_product_ids.length) {
    await sb.from("external_site_products").delete().eq("connection_id", conn.id).in("external_id", parsed.deleted_product_ids);
  }
  if (parsed.deleted_category_ids.length) {
    await sb.from("external_site_categories").delete().eq("connection_id", conn.id).in("external_id", parsed.deleted_category_ids);
  }
  if (parsed.replace) {
    // Rows not touched in this full sync are stale.
    await sb.from("external_site_products").delete().eq("connection_id", conn.id).lt("updated_at", now);
    await sb.from("external_site_categories").delete().eq("connection_id", conn.id).lt("updated_at", now);
  }
  const patch: any = { last_catalog_sync_at: now, site_type: "website" };
  if (parsed.contact && Object.keys(parsed.contact).length) patch.site_info = parsed.contact;
  if (parsed.categories.length <= 1 && parsed.products.length <= 1 && !parsed.replace) delete patch.site_type;
  await sb.from("landing_page_connections").update(patch).eq("id", conn.id);
  return {
    status: 200,
    body: { ok: true, categories: parsed.categories.length, products: parsed.products.length, deleted: parsed.deleted_product_ids.length },
  };
}

/** Delivers queued order updates to each website's status link, signed with its webhook secret. */
export async function dispatchOutbox(limit = 50): Promise<{ sent: number; failed: number }> {
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await sb.from("external_site_sync_outbox")
    .select("id,connection_id,event,payload,attempts")
    .eq("status", "queued").lte("run_at", new Date().toISOString())
    .order("created_at").limit(limit);
  let sent = 0, failed = 0;
  const connCache = new Map<string, { url: string | null; secret: string }>();
  for (const r of (rows ?? []) as any[]) {
    // Claim the row so parallel dispatchers never double-send.
    const { data: claimed } = await sb.from("external_site_sync_outbox")
      .update({ status: "sending", attempts: r.attempts + 1 }).eq("id", r.id).eq("status", "queued").select("id");
    if (!claimed?.length) continue;
    let c = connCache.get(r.connection_id);
    if (!c) {
      const [{ data: conn }, { data: cred }] = await Promise.all([
        sb.from("landing_page_connections").select("outbound_webhook_url").eq("id", r.connection_id).maybeSingle(),
        sb.from("landing_page_credentials").select("webhook_secret_enc").eq("connection_id", r.connection_id).maybeSingle(),
      ]);
      c = { url: conn?.outbound_webhook_url ?? null, secret: cred?.webhook_secret_enc ? decryptWebhookSecret(cred.webhook_secret_enc) : "" };
      connCache.set(r.connection_id, c);
    }
    let status = 0, error: string | null = null;
    try {
      if (!c.url) throw new Error("No status update link configured");
      const url = assertSafeOutboundUrl(c.url);
      const body = JSON.stringify({ event: r.event, data: r.payload });
      const ts = String(Math.floor(Date.now() / 1000));
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "content-type": "application/json",
          "x-orzen-event": r.event,
          "x-timestamp": ts,
          ...(c.secret ? { "x-signature": `sha256=${hmacSign(c.secret, body)}` } : {}),
        },
        body,
      });
      status = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = String((e as Error).message ?? e).slice(0, 300);
    }
    if (!error) {
      sent++;
      await sb.from("external_site_sync_outbox").update({ status: "sent", sent_at: new Date().toISOString(), response_status: status, last_error: null }).eq("id", r.id);
    } else {
      failed++;
      const attempts = r.attempts + 1;
      const giveUp = attempts >= 6;
      await sb.from("external_site_sync_outbox").update({
        status: giveUp ? "failed" : "queued",
        run_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
        response_status: status || null, last_error: error,
      }).eq("id", r.id);
    }
  }
  return { sent, failed };
}
