// Shared adapter contract + logged HTTP helper. Server-only.
import type { ParcelStatus } from "./status";

export type ApiLogEntry = {
  action: string;
  endpoint: string;
  method: string;
  request: unknown;
  response: unknown;
  http_status: number | null;
  duration_ms: number;
  ok: boolean;
  error: string | null;
};

export type AdapterCtx = {
  courierKey: string;
  baseUrl: string;
  creds: Record<string, string>;
  sandbox: boolean;
  pickup: Record<string, string | null | undefined>;
  logs: ApiLogEntry[];
};

export type ParcelInput = {
  id: string;
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity?: string | null;
  recipientZone?: string | null;
  recipientArea?: string | null;
  codAmount: number;
  weight?: number | null;
  itemCount: number;
  note?: string | null;
  items: Array<{ name: string; qty: number; price?: number }>;
  consignmentId?: string | null;
  trackingCode?: string | null;
};

export type CreateResult = {
  consignmentId?: string | null;
  trackingCode?: string | null;
  status: ParcelStatus;
  raw?: unknown;
};

export type StatusResult = {
  status: ParcelStatus;
  message?: string | null;
  raw?: unknown;
};

export type CourierAdapter = {
  key: string;
  /** false for couriers without a public merchant API (manual mode). */
  hasApi: boolean;
  supportsCancel?: boolean;
  supportsPickup?: boolean;
  /** Credential keys the courier API requires (validated before any call). */
  requiredCreds?: string[][];
  createParcel(ctx: AdapterCtx, parcel: ParcelInput): Promise<CreateResult>;
  getStatus?(ctx: AdapterCtx, parcel: ParcelInput): Promise<StatusResult>;
  /** Official label from the courier API, when the provider exposes one. */
  getLabel?(ctx: AdapterCtx, parcel: ParcelInput): Promise<{ url: string | null }>;
  cancelParcel?(ctx: AdapterCtx, parcel: ParcelInput): Promise<{ ok: boolean; message: string }>;
  requestPickup?(
    ctx: AdapterCtx,
    payload: { contactName?: string; phone?: string; address?: string; date?: string; parcelCount: number },
  ): Promise<{ ok: boolean; message: string; raw?: unknown }>;
};

const SECRET_KEYS = /(password|secret|token|key|authorization|paperflykey)/i;

/** Recursively mask credential-looking values before they reach the log table. */
export function mask(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(mask);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "•••" : mask(v);
    }
    return out;
  }
  return value;
}

export function trimUrl(u: string) {
  return (u ?? "").trim().replace(/\/+$/, "");
}

export type CallResult = {
  ok: boolean;
  httpStatus: number | null;
  json: any;
  text: string;
  error: string | null;
};

/** fetch + timing + masked logging, used by every adapter. */
export async function call(
  ctx: AdapterCtx,
  action: string,
  opts: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  },
): Promise<CallResult> {
  const method = opts.method ?? "GET";
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  let httpStatus: number | null = null;
  let text = "";
  let json: any = null;
  let error: string | null = null;
  try {
    const res = await fetch(opts.url, {
      method,
      headers: { Accept: "application/json", ...(opts.headers ?? {}) },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    httpStatus = res.status;
    text = (await res.text().catch(() => "")).slice(0, 4000);
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!res.ok) error = pickError(json, text, `HTTP ${res.status}`);
  } catch (e) {
    error = (e as Error).name === "AbortError" ? "Request timed out" : (e as Error).message;
  } finally {
    clearTimeout(timer);
  }
  const ok = error == null;
  ctx.logs.push({
    action,
    endpoint: opts.url,
    method,
    request: mask(opts.body ?? null),
    response: mask(json ?? (text ? { raw: text.slice(0, 1500) } : null)),
    http_status: httpStatus,
    duration_ms: Date.now() - started,
    ok,
    error,
  });
  return { ok, httpStatus, json, text, error };
}

export function pickError(json: any, text: string, fallback: string): string {
  const m =
    json?.message ??
    json?.error ??
    json?.errors?.[0]?.message ??
    (typeof json?.errors === "string" ? json.errors : null) ??
    (typeof json?.errors === "object" && json?.errors
      ? Object.values(json.errors).flat().join(", ")
      : null);
  if (typeof m === "string" && m.trim()) return m.slice(0, 400);
  if (text?.trim()) return text.slice(0, 200);
  return fallback;
}

export function basicAuth(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user ?? ""}:${pass ?? ""}`).toString("base64");
}
