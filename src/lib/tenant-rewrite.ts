// Client-side counterpart of the Worker's tenant host rewrite (src/server.ts).
//
// The Worker serves mystore.orzen.top/  by internally rendering /store/mystore
// while keeping the browser URL at "/". Without a matching rewrite the client
// router would hydrate "/" as the platform landing page and immediately replace
// the storefront that was just rendered. This module keeps both in sync.

export type TenantInfo = { kind: "store" | "landing"; slug: string };

/** Subdomain labels that always belong to the platform, never to a store. */
const RESERVED_LABELS = new Set([
  "www", "api", "admin", "app", "auth", "login", "signup", "dashboard", "store",
  "stores", "cdn", "assets", "static", "img", "images", "mail", "smtp", "ftp",
  "blog", "docs", "help", "support", "status", "billing", "pay", "payments",
  "checkout", "cart", "owner", "platform", "orzen", "test", "dev", "staging",
  "preview", "webhook", "webhooks", "ns1", "ns2", "mx",
]);

const EPHEMERAL_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".lovable.app",
  ".lovable.dev",
  ".sslip.io",
  ".localhost",
];

/** Paths that are never part of a storefront, on any host. */
const RESERVED_PREFIXES = [
  "/api/", "/_serverFn", "/_server", "/_build", "/assets/", "/store/", "/lp/",
  "/admin", "/owner", "/login", "/signup", "/.well-known", "/favicon", "/img/",
];

function rootDomain(): string {
  const injected =
    typeof window !== "undefined"
      ? (window as unknown as { __ORZEN_ROOT_DOMAIN__?: string }).__ORZEN_ROOT_DOMAIN__
      : undefined;
  return (injected || "orzen.top").toLowerCase();
}

/** Parse a store slug out of a hostname like `abdullah.orzen.top`. */
export function subdomainSlug(hostname: string, root = rootDomain()): string | null {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  if (!host.endsWith(`.${root}`)) return null;
  if (EPHEMERAL_SUFFIXES.some((s) => host.endsWith(s))) return null;
  const label = host.slice(0, -(root.length + 1));
  if (!label || label.includes(".")) return null;
  if (RESERVED_LABELS.has(label)) return null;
  return label;
}

/** True when the host is the platform itself (root, www, preview sandboxes). */
export function isPlatformHostname(hostname: string, root = rootDomain()): boolean {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  if (!host || host === "localhost" || host.startsWith("127.0.0.1") || host.startsWith("[")) {
    return true;
  }
  if (EPHEMERAL_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (host === root || host === `www.${root}`) return true;
  // Any other label under the platform root is a store subdomain unless reserved.
  if (host.endsWith(`.${root}`)) return subdomainSlug(host, root) === null;
  return false;
}

const CACHE_PREFIX = "orzen:tenant:";

function readCachedTenant(host: string): TenantInfo | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + host);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantInfo;
    return parsed?.slug && (parsed.kind === "store" || parsed.kind === "landing") ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedTenant(host: string, tenant: TenantInfo): void {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + host, JSON.stringify(tenant));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Tenant for the current browser host. Covers both wildcard subdomains
 * (`abdullah.orzen.top`) and fully custom domains mapped in Cloudflare — the
 * Worker injects the resolved tenant for those, and we cache it per host so a
 * client-side navigation or a cached HTML shell keeps the storefront frame.
 */
export function getBrowserTenant(): TenantInfo | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase().replace(/:\d+$/, "");

  const injected = (window as unknown as { __ORZEN_TENANT__?: TenantInfo }).__ORZEN_TENANT__;
  if (injected?.slug && (injected.kind === "store" || injected.kind === "landing")) {
    writeCachedTenant(host, injected);
    return injected;
  }

  // Wildcard subdomain: parseable without any server hint.
  const slug = subdomainSlug(host);
  if (slug) {
    const tenant: TenantInfo = { kind: "store", slug };
    writeCachedTenant(host, tenant);
    return tenant;
  }

  // Fully custom domain: no hint in this document, but the host is not the
  // platform, so reuse the tenant resolved earlier on this same host.
  if (!isPlatformHostname(host)) return readCachedTenant(host);
  return null;
}

/** Storefront paths that are platform routes at the root but tenant routes here. */
const TENANT_ONLY_PATHS = ["/auth", "/sitemap.xml", "/robots.txt"];

function isRewritable(pathname: string): boolean {
  if (RESERVED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return false;
  }
  if (TENANT_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  return true;
}


/**
 * Router rewrite pair for the current tenant host, or undefined on the
 * platform site. Both directions are idempotent so SSR (which already receives
 * the internal `/store/<slug>` path) is unaffected.
 */
export function getTenantRewrite() {
  const tenant = getBrowserTenant();
  if (!tenant) return undefined;
  const base = tenant.kind === "landing" ? `/lp/${tenant.slug}` : `/store/${tenant.slug}`;

  return {
    input: ({ url }: { url: URL }) => {
      const path = url.pathname;
      if (path === base || path.startsWith(`${base}/`)) return url;
      if (tenant.kind === "landing") {
        if (!isRewritable(path)) return url;
        const next = new URL(url.href);
        next.pathname = base;
        return next;
      }
      if (!isRewritable(path)) return url;
      const next = new URL(url.href);
      const suffix = path === "/" ? "" : path.replace(/\/$/, "");
      next.pathname = `${base}${suffix}`;
      return next;
    },
    output: ({ url }: { url: URL }) => {
      const path = url.pathname;
      if (path !== base && !path.startsWith(`${base}/`)) return url;
      const next = new URL(url.href);
      next.pathname = path.slice(base.length) || "/";
      return next;
    },
  };
}
