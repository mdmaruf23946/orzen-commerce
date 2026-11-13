// SSRF-safe fetch: validates the URL and every redirect hop with
// outboundUrlProblem, following at most `maxRedirects` hops manually.
// Stage C-4: credentials (sensitive headers or a request body) never cross
// origins on redirect — such redirects are refused instead of followed.
import { outboundUrlProblem } from "./outbound-url";

export class UnsafeUrlError extends Error {}

export function urlProblem(raw: string, allowHttp = false): string | null {
  if (allowHttp && /^http:\/\//i.test(raw)) return outboundUrlProblem(raw.replace(/^http:/i, "https:"));
  return outboundUrlProblem(raw);
}

const SENSITIVE_EXACT = new Set(["authorization", "proxy-authorization", "cookie"]);
export function isSensitiveHeader(name: string): boolean {
  const n = name.toLowerCase();
  return SENSITIVE_EXACT.has(n) || /(^|-)(key|token|secret|password|auth)($|-)/.test(n) || n.endsWith("-key") || n.endsWith("-token");
}

function hasSensitiveHeaders(headers: Headers): boolean {
  for (const [k] of headers) if (isSensitiveHeader(k)) return true;
  return false;
}

export async function safeFetch(
  url: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number; allowHttp?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const f = opts.fetchImpl ?? fetch;
  const max = opts.maxRedirects ?? 3;
  let current = url;
  const initialOrigin = new URL(url).origin;
  let method = (init.method ?? "GET").toUpperCase();
  let body = init.body ?? null;
  let headers = new Headers(init.headers);
  for (let hop = 0; hop <= max; hop++) {
    const problem = urlProblem(current, opts.allowHttp);
    if (problem) throw new UnsafeUrlError(`Blocked URL: ${problem}`);
    const res = await f(current, { ...init, method, headers, body, redirect: "manual" });
    if (res.status < 300 || res.status >= 400 || res.status === 304) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    const next = new URL(loc, current).toString();
    // 303 always becomes GET; 301/302 POST becomes GET (browser semantics).
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
      if (method !== "HEAD") method = "GET";
      body = null;
      headers.delete("content-type");
      headers.delete("content-length");
    }
    if (new URL(next).origin !== initialOrigin) {
      if (hasSensitiveHeaders(headers)) throw new UnsafeUrlError("Blocked cross-origin redirect carrying credentials");
      if (body != null) throw new UnsafeUrlError("Blocked cross-origin redirect carrying a request body");
      headers = new Headers(headers);
    }
    current = next;
  }
  throw new UnsafeUrlError("Too many redirects");
}
