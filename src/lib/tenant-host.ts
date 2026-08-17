// Edge-side host → store slug resolution used by the Worker entry (src/server.ts)
// to serve tenant domains at clean root URLs (mystore.com/  →  /store/<slug>/).
//
// Kept dependency-free (plain fetch against the Supabase REST RPC) so it can run
// before the app bundle is loaded.

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { slug: string | null; at: number }>();

const EPHEMERAL_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".lovable.app",
  ".lovable.dev",
  ".sslip.io",
  ".localhost",
];

/** Paths that must never be rewritten into the storefront. */
const RESERVED_PREFIXES = [
  "/api/",
  "/_serverFn",
  "/_server",
  "/_build",
  "/assets/",
  "/store/",
  "/admin",
  "/owner",
  "/auth",
  "/login",
  "/signup",
  "/.well-known",
  "/sitemap",
  "/robots",
  "/favicon",
  "/img/",
];

export function isRewritablePath(pathname: string): boolean {
  if (RESERVED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return false;
  }
  // Anything that looks like a static file is served as-is.
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  return true;
}

export function isPlatformHost(host: string, rootDomain: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.startsWith("127.0.0.1") || host.startsWith("[")) return true;
  if (EPHEMERAL_SUFFIXES.some((s) => host.endsWith(s))) return true;
  return host === rootDomain || host === `www.${rootDomain}`;
}

/** Subdomain of the platform root, e.g. mystore.orzen.top → "mystore". */
export function subdomainSlug(host: string, rootDomain: string): string | null {
  if (!host.endsWith(`.${rootDomain}`)) return null;
  const label = host.slice(0, -(rootDomain.length + 1));
  if (!label || label.includes(".") || label === "www") return null;
  return label;
}

async function lookupCustomDomain(host: string, env: Record<string, string | undefined>) {
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/resolve_domain`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
      },
      body: JSON.stringify({ _host: host }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { slug?: string } | null;
    return json?.slug ?? null;
  } catch {
    return null;
  }
}

/** Resolve an incoming Host header to a store slug, or null for the platform site. */
export async function resolveTenantSlug(
  host: string,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  const rootDomain = (env["PUBLIC_ROOT_DOMAIN"] ?? "orzen.top").toLowerCase();
  const clean = host.toLowerCase().replace(/:\d+$/, "");
  if (isPlatformHost(clean, rootDomain)) return null;

  const sub = subdomainSlug(clean, rootDomain);
  if (sub) return sub;
  if (clean.endsWith(`.${rootDomain}`)) return null;

  const hit = cache.get(clean);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.slug;

  const slug = await lookupCustomDomain(clean, env);
  cache.set(clean, { slug, at: Date.now() });
  return slug;
}
