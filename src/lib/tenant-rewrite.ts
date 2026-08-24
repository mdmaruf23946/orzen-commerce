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

/**
 * Tenant for the current browser host: the value injected by the Worker (which
 * also covers verified custom domains), otherwise a wildcard subdomain parse.
 */
export function getBrowserTenant(): TenantInfo | null {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as { __ORZEN_TENANT__?: TenantInfo }).__ORZEN_TENANT__;
  if (injected?.slug && (injected.kind === "store" || injected.kind === "landing")) {
    return injected;
  }
  const slug = subdomainSlug(window.location.hostname);
  return slug ? { kind: "store", slug } : null;
}

function isRewritable(pathname: string): boolean {
  if (RESERVED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return false;
  }
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".") && !pathname.startsWith("/auth")) return false;
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
