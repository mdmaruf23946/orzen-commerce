// Server-only SEO helpers: host -> store resolution and sitemap data.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function publicSb() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export function originFromRequest(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  return { host: host.toLowerCase().replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

/** Resolve the store slug that owns a hostname (subdomain or custom domain). */
export async function slugFromHost(host: string): Promise<string | null> {
  if (!host) return null;
  const sb = publicSb();
  const { data: pSettings } = await sb
    .from("platform_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const s = ((pSettings?.settings as any) ?? {}) as Record<string, string>;
  const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
  const loginHost = (s.login_host ?? "").toLowerCase();
  const platformHosts = new Set([rootDomain, `www.${rootDomain}`, loginHost].filter(Boolean));
  const isEphemeral =
    host === "localhost" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sslip.io");
  if (isEphemeral || platformHosts.has(host)) return null;

  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.slice(0, -(rootDomain.length + 1));
    if (slug && !slug.includes(".") && slug !== "www") return slug;
  }
  const { data } = await sb.rpc("resolve_domain", { _host: host });
  const r = data as any;
  return r?.slug ?? null;
}

export async function storeBySlug(slug: string) {
  const sb = publicSb();
  const { data } = await sb.rpc("get_public_store_by_slug", { _slug: slug });
  return (data as any) ?? null;
}

export type SitemapData = {
  store: any;
  products: { id: string; updated_at?: string | null }[];
  categories: { id: string }[];
};

export async function sitemapData(slug: string): Promise<SitemapData | null> {
  const store = await storeBySlug(slug);
  if (!store) return null;
  const sb = publicSb();
  const [{ data: products }, { data: categories }] = await Promise.all([
    sb
      .from("products")
      .select("id, updated_at")
      .eq("store_id", store.id)
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(5000),
    sb.from("categories").select("id").eq("store_id", store.id).eq("is_active", true).limit(1000),
  ]);
  return {
    store,
    products: (products ?? []) as any[],
    categories: (categories ?? []) as any[],
  };
}

export function renderSitemap(origin: string, base: string, data: SitemapData) {
  const root = base.replace(/\/$/, "");
  const urls: string[] = [];
  const push = (path: string, lastmod?: string | null, priority?: string, changefreq?: string) => {
    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(`${root}${path}`)}</loc>`,
        lastmod ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : null,
        changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
        priority ? `    <priority>${priority}</priority>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };
  push("/", null, "1.0", "daily");
  for (const c of data.categories) push(`/?category=${c.id}`, null, "0.5", "weekly");
  for (const p of data.products) push(`/product/${p.id}`, p.updated_at ?? null, "0.8", "weekly");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
