// Pure server-side engine that executes a configured Custom Payment Gateway
// against a real provider. Runs in Node/Workers runtime only.
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CustomGatewayConfig,
  CustomGatewayPublic,
  PlatformStatus,
} from "./types";
import { AUTH_SECRET_KEYS } from "./types";

export type CheckoutVars = {
  order_id: string;
  amount: number | string;
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  product_name: string;
  product_quantity: number | string;
  shipping_address: string;
  success_url: string;
  cancel_url: string;
  fail_url: string;
  callback_url: string;
  webhook_url: string;
  store_id: string;
  [k: string]: string | number;
};

export type Creds = Record<string, string>;

// -------- template rendering ------------------------------------------------

/** Replace {{var}} occurrences using vars, plus {{creds.key}} for auth. */
export function renderTemplate(str: string, vars: Record<string, unknown>, creds: Creds = {}): string {
  if (!str) return "";
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    if (key.startsWith("creds.")) {
      const k = key.slice(6);
      return creds[k] ?? "";
    }
    const v = (vars as Record<string, unknown>)[key];
    return v == null ? "" : String(v);
  });
}

export function readPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (typeof cur !== "object") return undefined;
    // support ["arr.0.field"]
    if (/^\d+$/.test(p) && Array.isArray(cur)) cur = cur[Number(p)];
    else cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Set a nested field on an object at a dotted path. */
function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] == null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// -------- request building --------------------------------------------------

export function baseUrl(gateway: Pick<CustomGatewayPublic, "environment" | "api_base_url" | "sandbox_base_url">): string {
  const production = (gateway.api_base_url ?? "").trim();
  const sandbox = (gateway.sandbox_base_url ?? "").trim() || production;
  const chosen = gateway.environment === "production" ? production : sandbox;
  return chosen.replace(/\/$/, "");
}

export function buildHeaders(
  authType: string,
  creds: Creds,
  headerTemplate: { key: string; value: string }[],
  vars: Record<string, unknown>,
  contentType: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  // Content-Type default
  if (contentType === "json") headers["Content-Type"] = "application/json";
  else if (contentType === "form_urlencoded") headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (contentType === "xml") headers["Content-Type"] = "application/xml";

  // Auth headers
  switch (authType) {
    case "api_key":
      if (creds.api_key) headers["X-API-Key"] = creds.api_key;
      break;
    case "api_key_secret":
      if (creds.api_key) headers["X-API-Key"] = creds.api_key;
      if (creds.api_secret) headers["X-API-Secret"] = creds.api_secret;
      break;
    case "bearer":
      if (creds.bearer_token) headers["Authorization"] = `Bearer ${creds.bearer_token}`;
      break;
    case "basic":
      if (creds.username || creds.password) {
        const enc = Buffer.from(`${creds.username ?? ""}:${creds.password ?? ""}`).toString("base64");
        headers["Authorization"] = `Basic ${enc}`;
      }
      break;
    case "custom_header": {
      const name = creds.custom_header_name || creds._custom_header_name;
      const value = creds.custom_header_value;
      if (name && value) headers[String(name)] = String(value);
      break;
    }
    default:
      break;
  }

  // User overrides / additions
  for (const h of headerTemplate ?? []) {
    if (!h?.key) continue;
    headers[h.key] = renderTemplate(h.value ?? "", vars, creds);
  }
  return headers;
}

export function buildBody(
  contentType: string,
  bodyTemplate: string,
  mapping: { source: string; target: string; staticValue?: string }[],
  vars: Record<string, unknown>,
  creds: Creds,
): { body: string | FormData | undefined; isForm: boolean } {
  if (bodyTemplate && bodyTemplate.trim()) {
    const rendered = renderTemplate(bodyTemplate, vars, creds);
    if (contentType === "form_data") {
      const fd = new FormData();
      try {
        const obj = JSON.parse(rendered);
        for (const [k, v] of Object.entries(obj)) fd.append(k, String(v ?? ""));
        return { body: fd, isForm: true };
      } catch {
        // Fallback: treat as urlencoded pairs.
        return { body: rendered, isForm: false };
      }
    }
    return { body: rendered, isForm: false };
  }

  // Build from mapping
  const shape: Record<string, unknown> = {};
  for (const m of mapping ?? []) {
    if (!m.target) continue;
    const value = m.source === "__static" ? m.staticValue ?? "" : vars[m.source];
    setPath(shape, m.target, value);
  }

  if (contentType === "json") return { body: JSON.stringify(shape), isForm: false };
  if (contentType === "form_urlencoded") {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(shape)) usp.append(k, String(v ?? ""));
    return { body: usp.toString(), isForm: false };
  }
  if (contentType === "form_data") {
    const fd = new FormData();
    for (const [k, v] of Object.entries(shape)) fd.append(k, String(v ?? ""));
    return { body: fd, isForm: true };
  }
  // XML minimal fallback
  const xml = Object.entries(shape)
    .map(([k, v]) => `<${k}>${String(v ?? "")}</${k}>`)
    .join("");
  return { body: `<request>${xml}</request>`, isForm: false };
}

// -------- signature ---------------------------------------------------------

export function signHmac(
  body: string,
  secret: string,
  algorithm: "sha256" | "sha512",
  encoding: "hex" | "base64",
): string {
  const h = createHmac(algorithm, secret).update(body).digest();
  return encoding === "hex" ? h.toString("hex") : h.toString("base64");
}

export function verifyWebhookSignature(
  cfg: CustomGatewayConfig,
  rawBody: string,
  headers: Headers,
  creds: Creds,
): boolean | null {
  const wh = cfg.webhook.signature;
  if (!wh || wh.type === "none") return null;

  if (wh.type === "hmac") {
    const secret = creds.hmac_secret ?? creds.api_secret ?? "";
    if (!secret) return false;
    const header = headers.get(wh.header || "X-Signature") ?? "";
    const provided = wh.prefix ? header.replace(wh.prefix, "") : header;
    const expected = signHmac(rawBody, secret, wh.algorithm, wh.encoding);
    try {
      const a = Buffer.from(provided.trim());
      const b = Buffer.from(expected.trim());
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  if (wh.type === "shared_secret") {
    const secret = creds.hmac_secret ?? "";
    const header = headers.get(wh.header || "X-Signature") ?? "";
    if (!secret) return false;
    return header === secret;
  }

  // custom → best-effort: header must match a rendered creds value.
  return null;
}

// -------- status normalization ---------------------------------------------

export function normalizeStatus(
  providerStatus: string | undefined | null,
  map: { from: string; to: PlatformStatus }[],
): PlatformStatus | null {
  if (!providerStatus) return null;
  const upper = String(providerStatus).trim();
  for (const row of map ?? []) {
    if (row.from && row.from.toUpperCase() === upper.toUpperCase()) return row.to;
  }
  return null;
}

// -------- execution --------------------------------------------------------

export type ExecResult = {
  ok: boolean;
  status: number;
  data: unknown;
  redirect_url: string | null;
  provider_ref: string | null;
  reference: string | null;
  provider_status: string | null;
  message: string | null;
  raw_text: string;
  error?: string;
};

async function readResponse(res: Response): Promise<{ data: unknown; raw: string }> {
  const raw = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    try {
      return { data: JSON.parse(raw), raw };
    } catch {
      return { data: raw, raw };
    }
  }
  return { data: raw, raw };
}

async function executeRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | FormData | undefined;
}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.method === "GET" || opts.method === "DELETE" ? undefined : opts.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function executeCheckout(
  gateway: CustomGatewayPublic,
  creds: Creds,
  vars: CheckoutVars,
): Promise<ExecResult> {
  const cfg = gateway.config;
  const url = `${baseUrl(gateway)}${cfg.request.endpoint || ""}`;
  const headers = buildHeaders(gateway.auth_type, creds, cfg.request.headers, vars, cfg.request.contentType);
  const { body } = buildBody(
    cfg.request.contentType,
    cfg.request.bodyTemplate,
    cfg.request.mapping,
    vars,
    creds,
  );

  try {
    const res = await executeRequest({ method: cfg.request.method, url, headers, body });
    const { data, raw } = await readResponse(res);
    const payUrl = readPath(data, cfg.checkout.responsePayUrlPath) as string | undefined;
    const txn = readPath(data, cfg.response.transactionIdPath) as string | undefined;
    const ref = readPath(data, cfg.response.referencePath) as string | undefined;
    const st = readPath(data, cfg.response.statusPath) as string | undefined;
    const msg = readPath(data, cfg.response.messagePath) as string | undefined;
    return {
      ok: res.ok && !!payUrl,
      status: res.status,
      data,
      redirect_url: payUrl ?? null,
      provider_ref: txn ?? null,
      reference: ref ?? null,
      provider_status: st ?? null,
      message: msg ?? null,
      raw_text: raw.slice(0, 4000),
    };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      data: null,
      redirect_url: null,
      provider_ref: null,
      reference: null,
      provider_status: null,
      message: null,
      raw_text: "",
      error: err,
    };
  }
}

export async function executeVerification(
  gateway: CustomGatewayPublic,
  creds: Creds,
  vars: CheckoutVars & { transaction_id: string },
): Promise<{ status: PlatformStatus | null; ok: boolean; raw: unknown; error?: string }> {
  const v = gateway.config.verification;
  if (v.method !== "api_status" || !v.endpoint) {
    return { status: null, ok: false, raw: null, error: "verification not configured" };
  }
  const cfg = gateway.config;
  const endpointRendered = renderTemplate(v.endpoint, { ...vars, transaction_id: vars.transaction_id }, creds);
  const url = `${baseUrl(gateway)}${endpointRendered}`;
  const headers = buildHeaders(gateway.auth_type, creds, cfg.request.headers, vars, cfg.request.contentType);
  try {
    const res = await executeRequest({
      method: v.httpMethod,
      url,
      headers,
      body: v.httpMethod === "GET" ? undefined : JSON.stringify({ [v.transactionIdParam]: vars.transaction_id }),
    });
    const { data } = await readResponse(res);
    const providerStatus = readPath(data, v.statusPath) as string | undefined;
    const upper = String(providerStatus ?? "").toUpperCase();
    const isSuccess = v.successValues.some((s) => s.toUpperCase() === upper);
    const normalized = isSuccess ? ("paid" as const) : normalizeStatus(providerStatus, cfg.statusMap);
    return { status: normalized, ok: res.ok, raw: data };
  } catch (e: unknown) {
    return { status: null, ok: false, raw: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Strip secret keys from a config object before persist. */
export function splitCredentials(
  authType: string,
  input: Record<string, unknown>,
): { creds: Creds; nonSecret: Record<string, string> } {
  const secretKeys = new Set(AUTH_SECRET_KEYS[authType as keyof typeof AUTH_SECRET_KEYS] ?? []);
  const creds: Creds = {};
  const nonSecret: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v == null) continue;
    const s = String(v);
    if (secretKeys.has(k)) creds[k] = s;
    else nonSecret[k] = s;
  }
  return { creds, nonSecret };
}
