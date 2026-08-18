// Shared, browser-safe SEO resolution for a store.
// Priority everywhere: Custom SEO -> Store defaults -> Automatic.

/** Canonical origin of the platform site (never a preview/deploy host). */
export const PLATFORM_ORIGIN = "https://orzen.top";

export type StoreSeo = {
  title?: string | null;
  description?: string | null;
  favicon_url?: string | null;
  canonical_url?: string | null;
  noindex?: boolean | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  twitter_image_url?: string | null;
  google_verification?: string | null;
  bing_verification?: string | null;
  sitemap_enabled?: boolean | null;
  robots_extra?: string | null;
};

export const SEO_DEFAULTS: Required<Pick<StoreSeo, "sitemap_enabled" | "noindex">> = {
  sitemap_enabled: true,
  noindex: false,
};

export type SeoStoreLike = {
  id?: string;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  icon_url?: string | null;
  favicon_url?: string | null;
  custom_favicon_url?: string | null;
  use_icon_as_favicon?: boolean | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  seo?: StoreSeo | null;
};

function clean(v?: string | null) {
  const s = (v ?? "").toString().trim();
  return s ? s : null;
}

export function absUrl(origin: string, v?: string | null): string | null {
  const s = clean(v);
  if (!s) return null;
  if (s.startsWith("http")) return s;
  return `${origin.replace(/\/$/, "")}${s.startsWith("/") ? "" : "/"}${s}`;
}

/** Automatic title when the admin left the field blank. */
export function autoTitle(store: SeoStoreLike, ctx?: { categories?: string[] }) {
  const name = clean(store.name) ?? "Online Store";
  const cats = (ctx?.categories ?? []).filter(Boolean).slice(0, 3);
  if (cats.length) return `${name} — ${cats.join(", ")} online`;
  return `${name} — Shop online`;
}

/** Automatic description when the admin left the field blank. */
export function autoDescription(
  store: SeoStoreLike,
  ctx?: { categories?: string[]; productCount?: number },
) {
  const name = clean(store.name) ?? "our store";
  const own = clean(store.description);
  if (own) return own.slice(0, 320);
  const cats = (ctx?.categories ?? []).filter(Boolean).slice(0, 4);
  const count = ctx?.productCount ?? 0;
  const bits = [
    `Shop at ${name}`,
    count ? `${count}+ products` : null,
    cats.length ? cats.join(", ") : null,
    "fast delivery and secure checkout.",
  ].filter(Boolean);
  return bits.join(" · ").slice(0, 320);
}

export function resolveFavicon(store: SeoStoreLike) {
  const seo = store.seo ?? {};
  const useIcon = store.use_icon_as_favicon !== false;
  return useIcon
    ? clean(store.favicon_url) ??
        clean(store.icon_url) ??
        clean(store.custom_favicon_url) ??
        clean(seo.favicon_url) ??
        clean(store.logo_url)
    : clean(store.custom_favicon_url) ??
        clean(store.favicon_url) ??
        clean(store.icon_url) ??
        clean(seo.favicon_url) ??
        clean(store.logo_url);
}

export type ResolvedSeo = {
  title: string;
  description: string;
  canonical: string | null;
  noindex: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  twitterImage: string | null;
  favicon: string | null;
  googleVerification: string | null;
  bingVerification: string | null;
};

export function resolveStoreSeo(
  store: SeoStoreLike,
  ctx: { origin?: string; path?: string; categories?: string[]; productCount?: number } = {},
): ResolvedSeo {
  const seo = store.seo ?? {};
  const origin = (ctx.origin ?? "").replace(/\/$/, "");
  const title = clean(seo.title) ?? autoTitle(store, ctx);
  const description = clean(seo.description) ?? autoDescription(store, ctx);
  const base = clean(seo.canonical_url) ?? (origin || null);
  const canonical = base
    ? `${base.replace(/\/$/, "")}${ctx.path && ctx.path !== "/" ? ctx.path : ""}` || base
    : null;
  const ogImage = absUrl(origin || base || "", clean(seo.og_image_url) ?? clean(store.logo_url) ?? clean(store.icon_url));
  const twitterImage = absUrl(origin || base || "", clean(seo.twitter_image_url)) ?? ogImage;
  return {
    title,
    description,
    canonical,
    noindex: seo.noindex === true,
    ogTitle: clean(seo.og_title) ?? title,
    ogDescription: clean(seo.og_description) ?? description,
    ogImage,
    twitterImage,
    favicon: resolveFavicon(store),
    googleVerification: clean(seo.google_verification),
    bingVerification: clean(seo.bing_verification),
  };
}

/** Head meta entries shared by every storefront page. */
export function storeHeadMeta(r: ResolvedSeo) {
  const meta: any[] = [
    { title: r.title },
    { name: "description", content: r.description },
    { property: "og:title", content: r.ogTitle },
    { property: "og:description", content: r.ogDescription },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
  if (r.canonical) meta.push({ property: "og:url", content: r.canonical });
  if (r.ogImage) meta.push({ property: "og:image", content: r.ogImage });
  if (r.twitterImage) meta.push({ name: "twitter:image", content: r.twitterImage });
  if (r.noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
  if (r.googleVerification)
    meta.push({ name: "google-site-verification", content: r.googleVerification });
  if (r.bingVerification) meta.push({ name: "msvalidate.01", content: r.bingVerification });
  return meta;
}

/* ------------------------------ JSON-LD ------------------------------ */

export function organizationJsonLd(store: SeoStoreLike, r: ResolvedSeo) {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name ?? r.title,
    description: r.description,
  };
  if (r.canonical) node.url = r.canonical;
  if (r.ogImage) node.logo = r.ogImage;
  const contact: Record<string, unknown> = {};
  if (store.phone) contact.telephone = store.phone;
  if (store.email) contact.email = store.email;
  if (Object.keys(contact).length)
    node.contactPoint = [{ "@type": "ContactPoint", contactType: "customer support", ...contact }];
  if (store.address) node.address = { "@type": "PostalAddress", streetAddress: store.address };
  return node;
}

export function websiteJsonLd(store: SeoStoreLike, r: ResolvedSeo) {
  const url = r.canonical;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.name ?? r.title,
  };
  if (url) {
    node.url = url;
    node.potentialAction = {
      "@type": "SearchAction",
      target: `${url.replace(/\/$/, "")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    };
  }
  return node;
}

export function productJsonLd(opts: {
  product: any;
  storeName?: string | null;
  url?: string | null;
  image?: string | null;
  currency?: string;
}) {
  const p = opts.product ?? {};
  const inStock =
    p.track_inventory === false || p.stock === null || p.stock === undefined || Number(p.stock) > 0;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: (p.description ?? "").toString().replace(/<[^>]*>/g, "").trim().slice(0, 500) || p.name,
    sku: p.sku || p.id,
  };
  if (opts.image) node.image = [opts.image];
  if (opts.storeName) node.brand = { "@type": "Brand", name: opts.storeName };
  node.offers = {
    "@type": "Offer",
    price: Number(p.price ?? 0),
    priceCurrency: opts.currency || "BDT",
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    ...(opts.url ? { url: opts.url } : {}),
  };
  return node;
}

export function breadcrumbJsonLd(items: { name: string; url?: string | null }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

export function jsonLdScript(nodes: unknown[]) {
  return { type: "application/ld+json", children: JSON.stringify(nodes.length === 1 ? nodes[0] : nodes) };
}

/* ------------------------------ robots.txt ------------------------------ */

export function buildRobotsTxt(opts: {
  origin: string;
  noindex?: boolean | null;
  sitemapEnabled?: boolean | null;
  extra?: string | null;
}) {
  const origin = opts.origin.replace(/\/$/, "");
  const lines = ["User-agent: *"];
  if (opts.noindex) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");
    lines.push("Disallow: /account");
    lines.push("Disallow: /cart");
    lines.push("Disallow: /checkout");
  }
  const extra = (opts.extra ?? "").trim();
  if (extra) lines.push("", extra);
  if (!opts.noindex && opts.sitemapEnabled !== false) lines.push("", `Sitemap: ${origin}/sitemap.xml`);
  return lines.join("\n") + "\n";
}

/* ------------------------------ SEO health ------------------------------ */

export type HealthState = "ok" | "warn" | "missing";
export type HealthItem = { key: string; label: string; state: HealthState; hint: string };

export function seoHealth(input: {
  store: SeoStoreLike;
  resolved: ResolvedSeo;
  productCount?: number;
}): HealthItem[] {
  const seo = input.store.seo ?? {};
  const r = input.resolved;
  const t = clean(seo.title);
  const d = clean(seo.description);
  const items: HealthItem[] = [];

  items.push(
    !t
      ? { key: "title", label: "Title", state: "warn", hint: "Using an automatic title — add a custom one." }
      : t.length < 25 || t.length > 60
        ? { key: "title", label: "Title", state: "warn", hint: `${t.length} characters — aim for 25–60.` }
        : { key: "title", label: "Title", state: "ok", hint: `${t.length} characters.` },
  );

  items.push(
    !d
      ? { key: "description", label: "Description", state: "warn", hint: "Using an automatic description." }
      : d.length < 70 || d.length > 160
        ? { key: "description", label: "Description", state: "warn", hint: `${d.length} characters — aim for 70–160.` }
        : { key: "description", label: "Description", state: "ok", hint: `${d.length} characters.` },
  );

  items.push(
    seo.sitemap_enabled === false
      ? { key: "sitemap", label: "Sitemap", state: "missing", hint: "Sitemap generation is turned off." }
      : {
          key: "sitemap",
          label: "Sitemap",
          state: "ok",
          hint: `${(input.productCount ?? 0) + 1} pages published.`,
        },
  );

  items.push({
    key: "schema",
    label: "Schema",
    state: "ok",
    hint: "Organization, WebSite, Product and Breadcrumb are generated automatically.",
  });

  items.push(
    r.favicon
      ? { key: "favicon", label: "Favicon", state: "ok", hint: "Favicon is set." }
      : { key: "favicon", label: "Favicon", state: "missing", hint: "Upload a favicon or store icon." },
  );

  items.push(
    r.googleVerification || r.bingVerification
      ? {
          key: "console",
          label: "Search Console",
          state: r.googleVerification && r.bingVerification ? "ok" : "warn",
          hint: r.googleVerification
            ? r.bingVerification
              ? "Google and Bing verified."
              : "Google tag added — Bing is empty."
            : "Bing tag added — Google is empty.",
        }
      : { key: "console", label: "Search Console", state: "missing", hint: "No verification tag added." },
  );

  if (r.noindex)
    items.unshift({
      key: "index",
      label: "Indexing",
      state: "missing",
      hint: "Search engines are blocked (No Index is on).",
    });

  return items;
}
