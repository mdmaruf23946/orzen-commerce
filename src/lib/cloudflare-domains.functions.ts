// Server functions the admin UI calls to manage customer custom domains
// through Cloudflare SSL for SaaS. Store-scoped (owner of the store) and
// owner-scoped (platform staff) variants.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeHost(h: string) {
  return h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

async function requireMyStore(supabase: any, userId: string) {
  const { data } = await supabase
    .from("stores").select("id, slug").eq("owner_user_id", userId).maybeSingle();
  if (!data) throw new Error("No store found for this account");
  return data as { id: string; slug: string };
}

/**
 * Provision a merchant custom domain through Cloudflare SSL for SaaS.
 * Creates the `store_domains` row AND registers the hostname with CF in one call.
 * CF returns DCV records (TXT for ownership + HTTP-01 for cert) which we
 * surface back to the merchant to add at their registrar.
 */
export const provisionCustomHostname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hostname: string }) =>
    z.object({ hostname: z.string().min(3).max(253) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const host = normalizeHost(data.hostname);
    if (!HOSTNAME_RE.test(host)) throw new Error("Invalid hostname format");

    const store = await requireMyStore(supabase, userId);
    const { attachCustomHostname } = await import("./cloudflare-ssl.server");
    const cfHost = await attachCustomHostname(host);

    const { data: row, error } = await supabase
      .from("store_domains")
      .insert({
        store_id: store.id,
        hostname: host,
        kind: "custom",
        status: "pending",
        dns_target: "stores.orzen.top",
        cf_hostname_id: cfHost.id,
        cf_status: cfHost.status,
        cf_ssl_status: cfHost.ssl.status,
        cf_ownership: cfHost.ownership_verification ?? null,
        cf_ssl_validation: cfHost.ssl.validation_records ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return {
      domain: row,
      dns_instructions: {
        cname: { name: host, target: "stores.orzen.top" },
        ownership_txt: cfHost.ownership_verification ?? null,
        ssl_validation: cfHost.ssl.validation_records ?? [],
      },
    };
  });

/** Poll Cloudflare for the latest status and mirror into store_domains. */
export const syncCustomHostname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) =>
    z.object({ domainId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("store_domains").select("*").eq("id", data.domainId).maybeSingle();
    if (!row?.cf_hostname_id) throw new Error("Hostname not provisioned with Cloudflare");

    const { getCustomHostname } = await import("./cloudflare-ssl.server");
    const cf = await getCustomHostname(row.cf_hostname_id);

    const patch: any = {
      cf_status: cf.status,
      cf_ssl_status: cf.ssl.status,
      cf_ownership: cf.ownership_verification ?? null,
      cf_ssl_validation: cf.ssl.validation_records ?? null,
      last_checked_at: new Date().toISOString(),
    };
    if (cf.status === "active" && cf.ssl.status === "active") {
      patch.status = "active";
      patch.verified_at = new Date().toISOString();
      patch.ssl_status = "issued";
    }
    await supabase.from("store_domains").update(patch).eq("id", row.id);
    // Custom domain live -> release the now-redundant platform subdomain.
    if (patch.status === "active" && row.landing_page_id) {
      const { releaseLandingSubdomain } = await import("./domain-lifecycle.server");
      await releaseLandingSubdomain(supabase, row.landing_page_id, "custom_domain_live").catch(() => null);
    }
    return { status: cf.status, ssl: cf.ssl.status };
  });

/** Ask Cloudflare to re-run DCV (after the merchant fixes DNS). */
export const revalidateCustomHostnameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) =>
    z.object({ domainId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("store_domains").select("cf_hostname_id").eq("id", data.domainId).maybeSingle();
    if (!row?.cf_hostname_id) throw new Error("Not provisioned");
    const { revalidateCustomHostname } = await import("./cloudflare-ssl.server");
    await revalidateCustomHostname(row.cf_hostname_id);
    return { ok: true };
  });

/** Detach from Cloudflare and delete the local row. */
export const releaseCustomHostname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) =>
    z.object({ domainId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("store_domains").select("cf_hostname_id").eq("id", data.domainId).maybeSingle();
    if (row?.cf_hostname_id) {
      const { detachCustomHostname } = await import("./cloudflare-ssl.server");
      await detachCustomHostname(row.cf_hostname_id);
    }
    await supabase.from("stores").update({ primary_domain_id: null }).eq("primary_domain_id", data.domainId);
    const { error } = await supabase.from("store_domains").delete().eq("id", data.domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
