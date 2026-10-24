// Server-only pipeline for landing-page order intake.
// Verifies auth, normalizes payload, resolves product, writes order + log
// via the service-role client. Never import from client-reachable modules
// at module scope.
import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { encryptJSON, decryptJSON } from "@/lib/crypto/credentials.server";

const MAX_BODY_BYTES = 64 * 1024;
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export type IntakeMethod = "webhook" | "api" | "embed";
export type IntakeStatus = "success" | "failed" | "duplicate" | "invalid" | "unauthorized" | "test";

export function generateApiKey(): { plaintext: string; hash: string; last4: string } {
  // "lp_" + 32 hex chars = 35 chars. Simple & recognizable.
  const plaintext = "lp_" + randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const last4 = plaintext.slice(-4);
  return { plaintext, hash, last4 };
}

export function generateWebhookSecret(): { plaintext: string; encrypted: string } {
  const plaintext = "whs_" + randomBytes(24).toString("hex");
  return { plaintext, encrypted: encryptJSON({ v: plaintext }) };
}

export function decryptWebhookSecret(enc: string): string {
  try {
    const obj = decryptJSON<{ v: string }>(enc);
    return obj.v;
  } catch {
    return "";
  }
}

export function hmacSign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyHmac(secret: string, body: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  if (!provided) return false;
  const expected = hmacSign(secret, body);
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyTimestamp(headerVal: string | null): boolean {
  if (!headerVal) return true; // timestamp optional but recommended
  const t = Number(headerVal);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const tsMs = t < 1e12 ? t * 1000 : t;
  return Math.abs(now - tsMs) <= REPLAY_WINDOW_MS;
}

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function requestHash(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

/**
 * Normalize an arbitrary landing-page payload into a canonical intake object,
 * applying any per-connection field mapping (external → internal key).
 */
export function normalizePayload(
  raw: Record<string, any>,
  fieldMap: Record<string, string> | null,
): Record<string, any> {
  const remapped: Record<string, any> = { ...raw };
  if (fieldMap) {
    for (const [ext, internal] of Object.entries(fieldMap)) {
      if (raw[ext] !== undefined && remapped[internal] === undefined) {
        remapped[internal] = raw[ext];
      }
    }
  }
  const p = remapped;
  return {
    customer_name:
      String(p.customer_name ?? p.customerName ?? p.name ?? p.full_name ?? "").trim(),
    phone: String(p.phone ?? p.mobile ?? p.contact ?? "").trim(),
    address: String(p.address ?? p.shipping_address ?? "").trim(),
    area: p.area ?? p.thana ?? p.upazila ?? p.district ?? null,
    quantity: Number(p.quantity ?? p.qty ?? 1) || 1,
    product_id: p.product_id ?? p.productId ?? null,
    external_product_id: p.external_product_id ?? p.sku ?? p.product_sku ?? null,
    variant: p.variant ?? p.product_variant ?? null,
    note: p.note ?? p.notes ?? p.customer_note ?? null,
    payment_method: (p.payment_method ?? p.paymentMethod ?? "cod").toString().toLowerCase(),
    txn_id: p.txn_id ?? p.transaction_id ?? null,
    landing_page_url: p.landing_page_url ?? p.page_url ?? p.url ?? null,
    external_order_id: p.external_order_id ?? p.order_id ?? p.reference ?? null,
    utm: {
      utm_source: p.utm_source ?? null,
      utm_medium: p.utm_medium ?? null,
      utm_campaign: p.utm_campaign ?? null,
      utm_term: p.utm_term ?? null,
      utm_content: p.utm_content ?? null,
      fbclid: p.fbclid ?? null,
      gclid: p.gclid ?? null,
      ttclid: p.ttclid ?? null,
    },
  };
}

/** Maps landing UTM/click IDs to one ad platform; direct/unknown → null. */
function utmPlatform(u: Record<string, any>): "facebook" | "google" | "tiktok" | null {
  const src = String(u?.utm_source ?? "").toLowerCase();
  if (u?.fbclid || ["facebook", "fb", "meta", "instagram", "ig"].includes(src)) return "facebook";
  if (u?.gclid || src === "google") return "google";
  if (u?.ttclid || src === "tiktok") return "tiktok";
  return null;
}

export interface IntakeInput {
  connectionId: string;
  rawBody: string;
  method: IntakeMethod;
  ip: string | null;
  ua: string | null;
  auth: {
    signature?: string | null;
    timestamp?: string | null;
    apiKey?: string | null;
    origin?: string | null;
  };
  isTest?: boolean;
}

export interface IntakeResult {
  status: number;
  body: Record<string, any>;
}

async function writeLog(
  sb: any,
  storeId: string,
  connectionId: string,
  status: IntakeStatus,
  extra: {
    external_order_id?: string | null;
    order_id?: string | null;
    request_hash?: string | null;
    ip?: string | null;
    ua?: string | null;
    request_snippet?: string | null;
    response_snippet?: string | null;
    error?: string | null;
    processing_ms?: number;
  },
) {
  await sb.from("landing_page_logs").insert({
    store_id: storeId,
    connection_id: connectionId,
    status,
    external_order_id: extra.external_order_id ?? null,
    order_id: extra.order_id ?? null,
    request_hash: extra.request_hash ?? null,
    ip: extra.ip ?? null,
    ua: extra.ua ?? null,
    request_snippet: (extra.request_snippet ?? "").slice(0, 800) || null,
    response_snippet: (extra.response_snippet ?? "").slice(0, 400) || null,
    error: extra.error ?? null,
    processing_ms: extra.processing_ms ?? null,
  });
}

/**
 * Main intake entrypoint used by all public routes.
 * Returns a { status, body } tuple ready to become a Response.
 */
export async function intakeLandingPageOrder(input: IntakeInput): Promise<IntakeResult> {
  const started = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin;
  const rHash = requestHash(input.rawBody);

  if (input.rawBody.length > MAX_BODY_BYTES) {
    return { status: 413, body: { ok: false, error: "Payload too large" } };
  }

  // 1. Fetch connection + credentials
  const { data: conn } = await sb
    .from("landing_page_connections")
    .select("id,store_id,status,default_product_id,platform,method")
    .eq("id", input.connectionId)
    .maybeSingle();
  if (!conn) return { status: 404, body: { ok: false, error: "Connection not found" } };
  if (conn.status !== "active") {
    return { status: 403, body: { ok: false, error: "Connection is paused" } };
  }

  const { data: creds } = await sb
    .from("landing_page_credentials")
    .select("webhook_secret_enc,api_key_hash")
    .eq("connection_id", conn.id)
    .maybeSingle();

  // 2. Verify auth
  let authOk = false;
  if (input.method === "webhook") {
    if (!verifyTimestamp(input.auth.timestamp ?? null)) {
      await writeLog(sb, conn.store_id, conn.id, "unauthorized", {
        request_hash: rHash, ip: input.ip, ua: input.ua, error: "Timestamp out of window",
      });
      return { status: 401, body: { ok: false, error: "Timestamp out of window" } };
    }
    const secret = creds?.webhook_secret_enc ? decryptWebhookSecret(creds.webhook_secret_enc) : "";
    authOk = !!secret && verifyHmac(secret, input.rawBody, input.auth.signature ?? null);
  } else if (input.method === "api") {
    const provided = (input.auth.apiKey ?? "").replace(/^Bearer\s+/i, "").trim();
    authOk = !!provided && !!creds?.api_key_hash && hashApiKey(provided) === creds.api_key_hash;
  } else if (input.method === "embed") {
    // Embed method uses connection id + optional origin allow-list; the id
    // itself acts as a public token, with rate-limiting via failed_count.
    authOk = true;
  }

  if (!authOk) {
    await writeLog(sb, conn.store_id, conn.id, "unauthorized", {
      request_hash: rHash, ip: input.ip, ua: input.ua, error: "Invalid signature or key",
    });
    return { status: 401, body: { ok: false, error: "Unauthorized" } };
  }

  // 3. Parse + normalize
  let parsed: any;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    await writeLog(sb, conn.store_id, conn.id, "invalid", {
      request_hash: rHash, ip: input.ip, ua: input.ua, error: "Invalid JSON",
    });
    return { status: 400, body: { ok: false, error: "Invalid JSON body" } };
  }

  const { data: fmap } = await sb
    .from("landing_page_field_map")
    .select("mapping")
    .eq("connection_id", conn.id)
    .maybeSingle();

  const canonical = normalizePayload(parsed, (fmap?.mapping as any) ?? null);

  if (!canonical.customer_name || !canonical.phone || !canonical.address) {
    await writeLog(sb, conn.store_id, conn.id, "invalid", {
      request_hash: rHash, ip: input.ip, ua: input.ua,
      request_snippet: input.rawBody,
      error: "Missing customer_name/phone/address",
    });
    return {
      status: 422,
      body: { ok: false, error: "customer_name, phone and address are required" },
    };
  }

  // 4. Idempotency check
  if (canonical.external_order_id) {
    const { data: existing } = await sb
      .from("orders")
      .select("id")
      .eq("landing_page_connection_id", conn.id)
      .eq("external_order_id", canonical.external_order_id)
      .maybeSingle();
    if (existing) {
      await writeLog(sb, conn.store_id, conn.id, "duplicate", {
        external_order_id: canonical.external_order_id,
        order_id: existing.id,
        request_hash: rHash, ip: input.ip, ua: input.ua,
        processing_ms: Date.now() - started,
      });
      return {
        status: 200,
        body: { ok: true, duplicate: true, order_id: existing.id },
      };
    }
  }

  // 5a. Multi-product website orders: { items: [{ product_id|external_product_id|sku, qty, price?, name?, variant? }] }
  if (Array.isArray(parsed.items) && parsed.items.length) {
    return intakeMultiItemOrder(sb, conn, input, parsed, canonical, rHash, started);
  }

  // 5. Resolve product: explicit map row → default_product_id → fail
  let productId: string | null = null;
  let productName: string | null = null;
  let productPrice = 0;

  if (canonical.external_product_id || canonical.product_id) {
    const key = canonical.external_product_id ?? canonical.product_id;
    const { data: map } = await sb
      .from("landing_page_product_map")
      .select("store_product_id,qty_multiplier")
      .eq("connection_id", conn.id)
      .or(`external_id.eq.${key},external_sku.eq.${key}`)
      .maybeSingle();
    if (map?.store_product_id) productId = map.store_product_id;
  }
  if (!productId) productId = conn.default_product_id ?? null;

  if (!productId) {
    await writeLog(sb, conn.store_id, conn.id, "invalid", {
      external_order_id: canonical.external_order_id,
      request_hash: rHash, ip: input.ip, ua: input.ua,
      request_snippet: input.rawBody,
      error: "No product mapped and no default product set",
    });
    return { status: 422, body: { ok: false, error: "Product mapping missing" } };
  }

  const { data: prod } = await sb
    .from("products")
    .select("id,name,price,stock,status,store_id")
    .eq("id", productId)
    .eq("store_id", conn.store_id)
    .maybeSingle();
  if (!prod) {
    await writeLog(sb, conn.store_id, conn.id, "failed", {
      request_hash: rHash, ip: input.ip, ua: input.ua,
      error: "Mapped product not found",
    });
    return { status: 422, body: { ok: false, error: "Mapped product not found" } };
  }
  productName = prod.name;
  productPrice = Number(prod.price) || 0;

  const qty = Math.max(1, Math.floor(canonical.quantity));
  const subtotal = productPrice * qty;

  // 6. Insert order + item
  const paymentMethod = ["cod", "bkash", "nagad", "rocket", "bank"].includes(
    canonical.payment_method,
  )
    ? canonical.payment_method
    : "cod";

  const noteText = [
    input.isTest ? "TEST ORDER" : null,
    canonical.note ? String(canonical.note).slice(0, 400) : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  const { data: order, error: oErr } = await sb
    .from("orders")
    .insert({
      store_id: conn.store_id,
      customer_name: canonical.customer_name.slice(0, 120),
      phone: canonical.phone.slice(0, 40),
      address: canonical.address.slice(0, 500),
      area: canonical.area ? String(canonical.area).slice(0, 120) : null,
      payment_method: paymentMethod,
      txn_id: canonical.txn_id ? String(canonical.txn_id).slice(0, 120) : null,
      notes: noteText,
      subtotal,
      status: "pending",
      source: "landing_page",
      landing_page_connection_id: conn.id,
      external_order_id: canonical.external_order_id
        ? String(canonical.external_order_id).slice(0, 120)
        : null,
      landing_page_url: canonical.landing_page_url
        ? String(canonical.landing_page_url).slice(0, 500)
        : null,
      utm: canonical.utm,
      attribution_platform: utmPlatform(canonical.utm),
      attribution_campaign: utmPlatform(canonical.utm) ? (canonical.utm.utm_campaign ? String(canonical.utm.utm_campaign).slice(0, 200) : null) : null,
      is_test: !!input.isTest,
    })
    .select("id,invoice_no")
    .single();

  if (oErr || !order) {
    await writeLog(sb, conn.store_id, conn.id, "failed", {
      request_hash: rHash, ip: input.ip, ua: input.ua,
      error: oErr?.message ?? "Insert failed",
    });
    // increment failed
    const { data: curFail } = await sb
      .from("landing_page_connections")
      .select("failed_count")
      .eq("id", conn.id)
      .single();
    await sb
      .from("landing_page_connections")
      .update({
        failed_count: (curFail?.failed_count ?? 0) + 1,
        last_error: oErr?.message ?? "Insert failed",
        last_error_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return { status: 500, body: { ok: false, error: "Could not create order" } };
  }

  const { error: iErr } = await sb.from("order_items").insert({
    order_id: order.id,
    product_id: prod.id,
    name_snapshot: productName,
    price_snapshot: productPrice,
    qty,
  });
  if (iErr) {
    await writeLog(sb, conn.store_id, conn.id, "failed", {
      order_id: order.id, request_hash: rHash, ip: input.ip, ua: input.ua,
      error: iErr.message,
    });
    await sb.from("order_timeline").delete().eq("order_id", order.id);
    await sb.from("orders").delete().eq("id", order.id);
    if (/out_of_stock/.test(iErr.message)) {
      return { status: 409, body: { ok: false, error: "Sorry, this item just sold out." } };
    }
    return { status: 500, body: { ok: false, error: "Order created but item failed" } };
  }

  // 7. Update counters + log success
  const { data: cur } = await sb
    .from("landing_page_connections")
    .select("orders_received")
    .eq("id", conn.id)
    .maybeSingle();
  await sb
    .from("landing_page_connections")
    .update({
      orders_received: (cur?.orders_received ?? 0) + 1,
      last_order_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    })
    .eq("id", conn.id);

  await writeLog(sb, conn.store_id, conn.id, input.isTest ? "test" : "success", {
    external_order_id: canonical.external_order_id,
    order_id: order.id,
    request_hash: rHash, ip: input.ip, ua: input.ua,
    processing_ms: Date.now() - started,
  });

  return {
    status: 200,
    body: {
      ok: true,
      order_id: order.id,
      invoice_no: order.invoice_no ?? null,
      test: !!input.isTest,
    },
  };
}

/** Website orders with several products. Prices come from the store or the synced website catalog. */
async function intakeMultiItemOrder(
  sb: any,
  conn: { id: string; store_id: string },
  input: IntakeInput,
  parsed: any,
  canonical: ReturnType<typeof normalizePayload>,
  rHash: string,
  started: number,
): Promise<IntakeResult> {
  const trusted = input.method !== "embed";
  const raw = (parsed.items as any[]).slice(0, 50);
  const lines: { product_id: string | null; name: string; price: number; qty: number }[] = [];
  for (const it of raw) {
    const key = String(it?.external_product_id ?? it?.sku ?? it?.product_id ?? it?.id ?? "").trim().slice(0, 120);
    const qty = Math.max(1, Math.min(999, Math.floor(Number(it?.qty ?? it?.quantity ?? 1) || 1)));
    const variant = it?.variant ? String(it.variant).slice(0, 120) : "";
    let line: { product_id: string | null; name: string; price: number } | null = null;
    if (key) {
      const { data: map } = await sb.from("landing_page_product_map")
        .select("store_product_id").eq("connection_id", conn.id)
        .or(`external_id.eq.${key.replace(/[,()]/g, "")},external_sku.eq.${key.replace(/[,()]/g, "")}`).maybeSingle();
      if (map?.store_product_id) {
        const { data: p } = await sb.from("products").select("id,name,price")
          .eq("id", map.store_product_id).eq("store_id", conn.store_id).maybeSingle();
        if (p) line = { product_id: p.id, name: p.name, price: Number(p.price) || 0 };
      }
      if (!line) {
        const { data: ext } = await sb.from("external_site_products").select("name,price,sale_price")
          .eq("connection_id", conn.id).eq("external_id", key).maybeSingle();
        const e2 = ext ?? (await sb.from("external_site_products").select("name,price,sale_price")
          .eq("connection_id", conn.id).eq("sku", key).limit(1).maybeSingle()).data;
        if (e2) {
          const price = trusted && it?.price != null && Number.isFinite(Number(it.price)) ? Number(it.price) : Number(e2.sale_price ?? e2.price) || 0;
          line = { product_id: null, name: e2.name, price };
        }
      }
    }
    if (!line && trusted && it?.name && Number.isFinite(Number(it?.price))) {
      line = { product_id: null, name: String(it.name).slice(0, 300), price: Number(it.price) };
    }
    if (!line) {
      await writeLog(sb, conn.store_id, conn.id, "invalid", {
        request_hash: rHash, ip: input.ip, ua: input.ua, request_snippet: input.rawBody,
        error: `Unknown product "${key || "?"}" — sync the catalog or send name + price`,
      });
      return { status: 422, body: { ok: false, error: `Unknown product: ${key || "missing id"}` } };
    }
    lines.push({ ...line, name: variant ? `${line.name} (${variant})` : line.name, qty });
  }

  const itemsTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = trusted ? Math.max(0, Number(parsed.delivery_charge ?? parsed.shipping ?? 0) || 0) : 0;
  const discount = trusted ? Math.max(0, Number(parsed.discount ?? 0) || 0) : 0;
  const paymentMethod = ["cod", "bkash", "nagad", "rocket", "bank"].includes(canonical.payment_method) ? canonical.payment_method : "cod";
  const noteText = [input.isTest ? "TEST ORDER" : null, canonical.note ? String(canonical.note).slice(0, 400) : null].filter(Boolean).join(" · ") || null;

  const { data: order, error: oErr } = await sb.from("orders").insert({
    store_id: conn.store_id,
    customer_name: canonical.customer_name.slice(0, 120),
    phone: canonical.phone.slice(0, 40),
    address: canonical.address.slice(0, 500),
    area: canonical.area ? String(canonical.area).slice(0, 120) : null,
    payment_method: paymentMethod,
    txn_id: canonical.txn_id ? String(canonical.txn_id).slice(0, 120) : null,
    notes: noteText,
    subtotal: Math.max(0, itemsTotal + delivery - discount), // grand total by convention
    delivery_amount: delivery,
    discount_amount: discount,
    status: "pending",
    source: "landing_page",
    landing_page_connection_id: conn.id,
    external_order_id: canonical.external_order_id ? String(canonical.external_order_id).slice(0, 120) : null,
    landing_page_url: canonical.landing_page_url ? String(canonical.landing_page_url).slice(0, 500) : null,
    utm: canonical.utm,
    attribution_platform: utmPlatform(canonical.utm),
    is_test: !!input.isTest,
  }).select("id,invoice_no").single();
  if (oErr || !order) {
    await writeLog(sb, conn.store_id, conn.id, "failed", { request_hash: rHash, ip: input.ip, ua: input.ua, error: oErr?.message ?? "Insert failed" });
    return { status: 500, body: { ok: false, error: "Could not create order" } };
  }
  const { error: iErr } = await sb.from("order_items").insert(lines.map((l) => ({
    order_id: order.id, product_id: l.product_id, name_snapshot: l.name, price_snapshot: l.price, qty: l.qty,
  })));
  if (iErr) {
    await sb.from("order_timeline").delete().eq("order_id", order.id);
    await sb.from("orders").delete().eq("id", order.id);
    await writeLog(sb, conn.store_id, conn.id, "failed", { request_hash: rHash, ip: input.ip, ua: input.ua, error: iErr.message });
    return { status: /out_of_stock/.test(iErr.message) ? 409 : 500, body: { ok: false, error: /out_of_stock/.test(iErr.message) ? "Sorry, an item just sold out." : "Order items failed" } };
  }
  const { data: cur } = await sb.from("landing_page_connections").select("orders_received").eq("id", conn.id).maybeSingle();
  await sb.from("landing_page_connections").update({
    orders_received: (cur?.orders_received ?? 0) + 1, last_order_at: new Date().toISOString(), last_error: null, last_error_at: null,
  }).eq("id", conn.id);
  await writeLog(sb, conn.store_id, conn.id, input.isTest ? "test" : "success", {
    external_order_id: canonical.external_order_id, order_id: order.id, request_hash: rHash, ip: input.ip, ua: input.ua,
    processing_ms: Date.now() - started,
  });
  return { status: 200, body: { ok: true, order_id: order.id, invoice_no: order.invoice_no ?? null, items: lines.length, test: !!input.isTest } };
}
