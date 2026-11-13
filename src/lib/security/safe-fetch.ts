// SSRF-safe fetch: validates the URL and every redirect hop with
// outboundUrlProblem, following at most `maxRedirects` hops manually.
import { outboundUrlProblem } from "./outbound-url";

export class UnsafeUrlError extends Error {}

export function urlProblem(raw: string, allowHttp = false): string | null {
  if (allowHttp && /^http:\/\//i.test(raw)) return outboundUrlProblem(raw.replace(/^http:/i, "https:"));
  return outboundUrlProblem(raw);
}

export async function safeFetch(
  url: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number; allowHttp?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const f = opts.fetchImpl ?? fetch;
  const max = opts.maxRedirects ?? 3;
  let current = url;
  for (let hop = 0; hop <= max; hop++) {
    const problem = urlProblem(current, opts.allowHttp);
    if (problem) throw new UnsafeUrlError(`Blocked URL: ${problem}`);
    const res = await f(current, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400 || res.status === 304) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    current = new URL(loc, current).toString();
  }
  throw new UnsafeUrlError("Too many redirects");
}
