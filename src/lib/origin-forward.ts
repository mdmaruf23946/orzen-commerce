// Cloudflare → Lovable internal secure forwarding.
//
// The Cloudflare deployment serves the site, but it does not hold the private
// server keys (service role, credential encryption, AI key). Instead of asking
// the operator to copy secrets around, any request that needs those keys is
// forwarded server-to-server to the Lovable deployment, which already has
// them. The browser never sees a redirect and never sees another domain: the
// forward happens inside the worker and the response is returned as-is.
//
// Nothing is forwarded when the local deployment has its own keys, so the
// Lovable hosting path is completely unaffected.

import { serverEnv } from "./server-env";

/** Marks an already-forwarded request so two deployments can never loop. */
export const FORWARD_MARKER = "x-orzen-forwarded";

const DEFAULT_UPSTREAM = "https://orzen-commerce.lovable.app";

/** Server-only paths that require the private keys. */
const FORWARDABLE_PREFIXES = ["/api/", "/_serverFn", "/_server", "/lovable/"];

export function upstreamOrigin(): string {
  const configured = serverEnv("LOVABLE_UPSTREAM_ORIGIN");
  return (configured ?? DEFAULT_UPSTREAM).replace(/\/$/, "");
}

/** True when this deployment cannot run server work itself. */
export function missingServerKeys(): boolean {
  return !serverEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isForwardablePath(pathname: string): boolean {
  return FORWARDABLE_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

export function shouldForward(request: Request, url: URL): boolean {
  if (request.headers.get(FORWARD_MARKER)) return false; // loop guard
  if (!isForwardablePath(url.pathname)) return false;
  if (!missingServerKeys()) return false;
  const upstream = upstreamOrigin();
  // Never forward to ourselves.
  try {
    if (new URL(upstream).hostname.toLowerCase() === url.hostname.toLowerCase()) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * Forward the request to the Lovable deployment, preserving method, headers,
 * cookies and body. Credentials stay server-side; nothing is logged.
 */
export async function forwardToUpstream(request: Request, url: URL): Promise<Response> {
  const target = new URL(url.pathname + url.search, upstreamOrigin());

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set(FORWARD_MARKER, "1");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (error) {
    console.error("[origin-forward] upstream request failed", error);
    return new Response(
      JSON.stringify({ error: "Backend service is temporarily unreachable. Please try again." }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.set("x-orzen-upstream", "lovable");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
