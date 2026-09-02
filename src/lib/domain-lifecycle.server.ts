// Central place where hostnames are released from Cloudflare and brought back.
//
// "Released" means: the hostname no longer exists on Cloudflare, but the row
// stays in our database so the merchant keeps the label / the domain and can
// press Reconnect at any time.
//
// Used by: landing page deletion, custom-domain-goes-live retirement, the idle
// sweep cron, and the manual Reconnect buttons.

export type ReleaseReason = "custom_domain_live" | "idle" | "manual";

/** Detach a platform subdomain (<label>.<root>) from the Worker. */
export async function releaseSubdomainHost(hostname: string) {
  try {
    const { detachSubdomain } = await import("@/lib/cloudflare-pages.server");
    await detachSubdomain(hostname);
    return { ok: true, error: null as string | null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Re-register a platform subdomain on the Worker. */
export async function reattachSubdomainHost(hostname: string) {
  const { ensureSubdomainAttached, subdomainAutomationConfigured } = await import(
    "@/lib/cloudflare-pages.server"
  );
  if (!subdomainAutomationConfigured()) {
    return { ok: false, error: "Cloudflare automation is not configured on this platform yet." };
  }
  try {
    const res = await ensureSubdomainAttached(hostname);
    return { ok: res.ok, error: res.error ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Detach a custom hostname from Cloudflare SSL for SaaS. */
export async function releaseCustomHost(cfHostnameId: string | null) {
  if (!cfHostnameId) return { ok: true, error: null as string | null };
  try {
    const { detachCustomHostname } = await import("@/lib/cloudflare-ssl.server");
    await detachCustomHostname(cfHostnameId);
    return { ok: true, error: null as string | null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Re-create a custom hostname on Cloudflare SSL for SaaS. */
export async function reattachCustomHost(hostname: string) {
  try {
    const { attachCustomHostname } = await import("@/lib/cloudflare-ssl.server");
    const cf = await attachCustomHostname(hostname);
    return { ok: true, cf, error: null as string | null };
  } catch (e) {
    return { ok: false, cf: null as any, error: (e as Error).message };
  }
}

const RELEASED_PATCH = (reason: ReleaseReason) => ({
  status: "released",
  ssl_status: "none",
  released_at: new Date().toISOString(),
  release_reason: reason,
  last_checked_at: new Date().toISOString(),
});

/**
 * Release the landing subdomain of a page (row kept, Cloudflare cleaned).
 * `hard = true` deletes the row too (used when the whole page is deleted).
 */
export async function releaseLandingSubdomain(
  supabase: any,
  pageId: string,
  reason: ReleaseReason,
  hard = false,
) {
  const { data: rows } = await supabase
    .from("landing_page_domains")
    .select("id,hostname,status")
    .eq("landing_page_id", pageId)
    .eq("kind", "subdomain");
  for (const row of (rows ?? []) as any[]) {
    await releaseSubdomainHost(row.hostname);
    if (hard) {
      await supabase.from("landing_page_domains").delete().eq("id", row.id);
    } else if (row.status !== "released") {
      await supabase.from("landing_page_domains").update(RELEASED_PATCH(reason) as never).eq("id", row.id);
    }
  }
  return (rows ?? []).length;
}

/**
 * Release custom domains attached to a landing page. The `store_domains` row
 * always stays (the merchant owns that domain); only Cloudflare is cleaned.
 * `detach = true` also clears the landing page attachment (page deletion).
 */
export async function releaseLandingCustomDomains(
  supabase: any,
  pageId: string,
  reason: ReleaseReason,
  detach = false,
) {
  const { data: rows } = await supabase
    .from("store_domains")
    .select("id,hostname,cf_hostname_id,status")
    .eq("landing_page_id", pageId);
  for (const row of (rows ?? []) as any[]) {
    await releaseCustomHost(row.cf_hostname_id);
    await supabase
      .from("store_domains")
      .update({
        ...RELEASED_PATCH(reason),
        cf_hostname_id: null,
        cf_status: null,
        cf_ssl_status: null,
        ...(detach ? { landing_page_id: null } : {}),
      } as never)
      .eq("id", row.id);
  }
  return (rows ?? []).length;
}

/** Release the store's own <slug>.<root> subdomain from Cloudflare. */
export async function releaseStoreSubdomain(
  supabase: any,
  storeId: string,
  hostname: string,
  reason: ReleaseReason,
) {
  const res = await releaseSubdomainHost(hostname);
  await supabase
    .from("stores")
    .update({
      subdomain_released_at: new Date().toISOString(),
      subdomain_release_reason: reason,
    } as never)
    .eq("id", storeId)
    .then(
      () => null,
      () => null,
    );
  return res;
}
