// SEO server functions: request origin for the storefront head, and the
// admin overview (store URL + automatic-SEO context + health counts).
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRequestOrigin = createServerFn({ method: "GET" }).handler(() => {
  try {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    /* no request context */
  }
  return "";
});

export const getMySeoOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const store = await myStoreRow(supabase, userId, "id, slug, name, description, logo_url, icon_url, favicon_url, custom_favicon_url, use_icon_as_favicon, phone, email, address, seo");
    if (!store) throw new Error("No store found for this account");

    const [{ data: cats }, { count: productCount }, { data: domains }, { data: pSettings }] =
      await Promise.all([
        supabase
          .from("categories")
          .select("name")
          .eq("store_id", (store as any).id)
          .eq("is_active", true)
          .limit(8),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", (store as any).id)
          .neq("status", "draft"),
        supabase
          .from("store_domains")
          .select("hostname, is_primary, status")
          .eq("store_id", (store as any).id),
        supabase.from("platform_settings").select("settings").eq("id", 1).maybeSingle(),
      ]);

    const settings = ((pSettings?.settings as any) ?? {}) as Record<string, string>;
    const rootDomain = (settings.root_domain ?? "orzen.top").toLowerCase();
    const primary = (domains ?? []).find((d: any) => d.is_primary && d.status === "verified");
    const storeUrl = primary
      ? `https://${(primary as any).hostname}`
      : `https://${(store as any).slug}.${rootDomain}`;

    return {
      store,
      storeUrl,
      categories: (cats ?? []).map((c: any) => c.name).filter(Boolean),
      productCount: productCount ?? 0,
      categoryCount: (cats ?? []).length,
    };
  });
