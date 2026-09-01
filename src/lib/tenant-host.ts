// Edge-side host → store resolution used by the Worker entry (src/server.ts)
// to serve tenant domains at clean root URLs (mystore.com/  →  /store/<slug>/).
//
// Kept dependency-free (plain fetch against the Supabase REST RPC) so it can run
// before the app bundle is loaded. Every failure falls back to the platform site.

const CACHE_TTL_MS = 60_000;
const SETTINGS_TTL_MS = 300_000;

type Tenant = { slug: string; primaryHostname: string | null };

const cache = new Map<string, { tenant: Tenant | null; at: number }>();
let settingsCache: { value: RoutingHosts; at: number } | null = null;

export type RoutingHosts = {
  rootDomain: string;
  loginHost: string;
  dnsTarget: string;
};

const EPHEMERAL_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".lovable.app",
  ".lovable.dev",
  ".sslip.io",
  ".localhost",
];

/** Subdomain labels that always belong to the platform, never to a store. */
const RESERVED_LABELS = new Set([
  "www", "api", "admin", "app", "auth", "login", "signup", "dashboard", "store",
  "stores", "cdn", "assets", "static", "img", "images", "mail", "smtp", "ftp",
  "blog", "docs", "help", "support", "status", "billing", "pay", "payments",
  "checkout", "cart", "owner", "platform", "orzen", "test", "dev", "staging",
  "preview", "webhook", "webhooks", "ns1", "ns2", "mx",
]);

/** Paths that must never be rewritten into the storefront, on any host. */
const RESERVED_PREFIXES = [
  "/api/",
  "/_serverFn",
  "/_server",
  "/_build",
  "/assets/",
  "/store/",
  "/admin",
  "/owner",
  "/login",
  "/signup",
  "/.well-known",
  "/favicon",
  "/img/",
];

/**
 * Storefront paths that live under /store/<slug>/ but are also platform routes
 * at the root. On a tenant host they belong to the store.
 */
const TENANT_ONLY_PATHS = ["/auth", "/sitemap.xml"];

export function isRewritablePath(pathname: string): boolean {
  if (RESERVED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return false;
  }
  if (TENANT_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Anything that looks like a static file is served as-is.
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  return true;
}

async function rpc<T>(
  name: string,
  body: unknown,
  env: Record<string, string | undefined>,
): Promise<T | null> {
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Platform hostnames (root, login host, CNAME target) — cached for 5 minutes. */
export async function getRoutingHosts(
  env: Record<string, string | undefined>,
): Promise<RoutingHosts> {
  const fallbackRoot = (env["PUBLIC_ROOT_DOMAIN"] ?? "orzen.top").toLowerCase();
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;

  const json = await rpc<{ root_domain?: string; login_host?: string; dns_target?: string }>(
    "platform_routing_hosts",
    {},
    env,
  );
  const value: RoutingHosts = {
    rootDomain: (json?.root_domain || fallbackRoot).toLowerCase(),
    loginHost: (json?.login_host || "").toLowerCase(),
    dnsTarget: (json?.dns_target || "").toLowerCase(),
  };
  settingsCache = { value, at: Date.now() };
  return value;
}

export function isPlatformHost(host: string, hosts: RoutingHosts): boolean {
  if (!host) return true;
  if (host === "localhost" || host.startsWith("127.0.0.1") || host.startsWith("[")) return true;
  if (EPHEMERAL_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (host === hosts.rootDomain || host === `www.${hosts.rootDomain}`) return true;
  if (hosts.loginHost && host === hosts.loginHost) return true;
  if (hosts.dnsTarget && host === hosts.dnsTarget) return true;
  return false;
}

/** Subdomain of the platform root, e.g. mystore.orzen.top → "mystore". */
export function subdomainSlug(host: string, rootDomain: string): string | null {
  if (!host.endsWith(`.${rootDomain}`)) return null;
  const label = host.slice(0, -(rootDomain.length + 1));
  if (!label || label.includes(".")) return null;
  if (RESERVED_LABELS.has(label)) return null;
  return label;
}

/**
 * Resolve an incoming Host header to a tenant, or null for the platform site.
 * `primaryHostname` is the store's canonical host when one is configured.
 */
export async function resolveTenant(
  host: string,
  env: Record<string, string | undefined>,
): Promise<Tenant | null> {
  const hosts = await getRoutingHosts(env);
  const clean = host.toLowerCase().replace(/:\d+$/, "");
  if (isPlatformHost(clean, hosts)) return null;

  const sub = subdomainSlug(clean, hosts.rootDomain);
  if (sub) return { slug: sub, primaryHostname: null };
  // Any other label under the platform root (reserved or nested) is platform.
  if (clean.endsWith(`.${hosts.rootDomain}`)) return null;

  const hit = cache.get(clean);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenant;

  const json = await rpc<{ slug?: string; primary_hostname?: string | null } | null>(
    "resolve_domain",
    { _host: clean },
    env,
  );
  const tenant: Tenant | null = json?.slug
    ? { slug: json.slug, primaryHostname: (json.primary_hostname || null)?.toLowerCase() ?? null }
    : null;
  cache.set(clean, { tenant, at: Date.now() });
  return tenant;
}

/** Back-compat helper: slug only. */
export async function resolveTenantSlug(
  host: string,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  return (await resolveTenant(host, env))?.slug ?? null;
}

// ---------- Landing pages ----------

export type HostTarget =
  | { kind: "store"; slug: string; primaryHostname: string | null }
  | { kind: "landing"; slug: string; primaryHostname: string | null };

const hostCache = new Map<string, { target: HostTarget | null; at: number }>();

/**
 * Resolve an incoming Host header to either a storefront or a builder landing
 * page. Returns null for the platform site.
 */
export async function resolveHostTarget(
  host: string,
  env: Record<string, string | undefined>,
): Promise<HostTarget | null> {
  const hosts = await getRoutingHosts(env);
  const clean = host.toLowerCase().replace(/:\d+$/, "");
  if (isPlatformHost(clean, hosts)) return null;

  const hit = hostCache.get(clean);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.target;

  const json = await rpc<{
    kind?: string;
    slug?: string;
    primary_hostname?: string | null;
  } | null>("resolve_host_kind", { _host: clean }, env);

  let target: HostTarget | null = null;
  if (json?.slug && (json.kind === "landing" || json.kind === "store")) {
    target = {
      kind: json.kind,
      slug: json.slug,
      primaryHostname: (json.primary_hostname || null)?.toLowerCase() ?? null,
    };
  } else {
    // Fall back to plain store resolution (reserved-label rules included).
    const tenant = await resolveTenant(clean, env);
    if (tenant) target = { kind: "store", slug: tenant.slug, primaryHostname: tenant.primaryHostname };
  }

  hostCache.set(clean, { target, at: Date.now() });
  return target;
}

const landingHostCache = new Map<string, { host: string | null; at: number }>();

/**
 * Public hostname a published landing page lives on (custom domain or platform
 * subdomain), or null when it only exists under /lp/<slug> on the platform.
 */
export async function landingPublicHost(
  slug: string,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  const key = slug.toLowerCase();
  const hit = landingHostCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.host;
  const host = await rpc<string | null>("landing_public_host", { _slug: key }, env);
  const value = typeof host === "string" && host ? host.toLowerCase() : null;
  landingHostCache.set(key, { host: value, at: Date.now() });
  return value;
}
