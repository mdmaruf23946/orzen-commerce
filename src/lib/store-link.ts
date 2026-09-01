// Client-side helper for linking to a storefront from the Merchant/Owner panel.
//
// The storefront must open OUTSIDE the platform app. `https://orzen.top/store/<slug>`
// is inside the platform PWA scope, so an installed ORZEN app captures it and shows
// the ORZEN splash/icon before the store. Linking the store's own host
// (`https://<slug>.orzen.top` or its custom domain) keeps the two apps separate.
//
// On preview/sandbox hosts (.lovable.app, localhost, …) the per-store host does not
// exist, so we keep the path-based URL there for development.

const EPHEMERAL_SUFFIXES = [
  ".workers.dev",
  ".pages.dev",
  ".lovable.app",
  ".lovable.dev",
  ".sslip.io",
  ".localhost",
];

function rootDomain(): string {
  const injected =
    typeof window !== "undefined"
      ? (window as unknown as { __ORZEN_ROOT_DOMAIN__?: string }).__ORZEN_ROOT_DOMAIN__
      : undefined;
  return (injected || "orzen.top").toLowerCase();
}

/** True when the browser is on a real platform production host. */
export function onProductionPlatformHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === "localhost" || host.startsWith("127.0.0.1") || host.startsWith("[")) {
    return false;
  }
  if (EPHEMERAL_SUFFIXES.some((s) => host.endsWith(s))) return false;
  const root = rootDomain();
  return host === root || host === `www.${root}`;
}

/**
 * Public href for a storefront page.
 * `publicUrl` is the store's canonical origin resolved server-side (custom domain
 * or `<slug>.<root>`); when it is unknown we derive `<slug>.<root>`.
 */
export function storeHref(slug: string, path = "", publicUrl?: string | null): string {
  const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  if (!slug) return suffix || "/";
  if (onProductionPlatformHost()) {
    const origin = publicUrl && /^https?:\/\//.test(publicUrl)
      ? publicUrl.replace(/\/$/, "")
      : `https://${slug}.${rootDomain()}`;
    return `${origin}${suffix}`;
  }
  return `/store/${slug}${suffix}`;
}
