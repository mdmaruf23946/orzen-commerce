/**
 * Canonical public URL of a storefront.
 *
 * The storefront must never be linked as a path on the platform site
 * (orzen.top/store/<slug>): that URL sits inside the platform PWA's install
 * scope, so on a device with the ORZEN app installed the store opens *inside*
 * the ORZEN app (ORZEN splash, ORZEN icon). Linking the store's own host keeps
 * the two apps completely separate.
 */
export async function storePublicUrl(
  supabase: { from: (t: string) => any },
  storeId: string,
  slug: string,
): Promise<string> {
  let rootDomain = "orzen.top";
  let hostname: string | null = null;
  try {
    const [{ data: settings }, { data: domains }] = await Promise.all([
      supabase.from("platform_settings").select("settings").eq("id", 1).maybeSingle(),
      supabase
        .from("store_domains")
        .select("hostname,is_primary,status,kind,landing_page_id")
        .eq("store_id", storeId),
    ]);
    rootDomain = (((settings?.settings as any) ?? {}).root_domain ?? "orzen.top").toLowerCase();
    const primary = (domains ?? []).find(
      (d: any) =>
        d.is_primary &&
        !d.landing_page_id &&
        ["verified", "active"].includes(String(d.status)),
    );
    hostname = primary ? String(primary.hostname).toLowerCase() : null;
  } catch {
    // Fall back to the platform subdomain below.
  }
  return `https://${hostname ?? `${slug}.${rootDomain}`}`;
}
