// Domain management server functions.
// Store-scoped: subdomain edit + custom domain lifecycle + primary selection.
// Owner-scoped: platform-wide domain view + settings.
//
// All DNS work goes through DNS-over-HTTPS (see dns-lookup.server.ts) because
// node:dns does not exist in the Cloudflare Workers runtime.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const RESERVED_SLUGS = new Set([
  "www", "api", "admin", "app", "auth", "login", "signup", "dashboard", "store",
  "stores", "cdn", "assets", "static", "img", "images", "mail", "smtp", "ftp",
  "blog", "docs", "help", "support", "status", "billing", "pay", "payments",
  "checkout", "cart", "owner", "platform", "orzen", "test", "dev", "staging",
  "preview", "webhook", "webhooks", "ns1", "ns2", "mx",
]);

function normalizeHost(h: string) {
  return h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

/** true when the hostname has no subdomain label (example.com, not shop.example.com) */
function isApex(host: string) {
  return host.split(".").filter(Boolean).length <= 2;
}

async function requireMyStore(supabase: any, userId: string) {
  const { data: store } = await supabase
    .from("stores")
    .select("id, slug, primary_domain_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!store) throw new Error("No store found for this account");
  return store as { id: string; slug: string; primary_domain_id: string | null };
}

async function requireOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

export type PlatformDomainSettings = {
  rootDomain: string;
  loginHost: string;
  dnsTarget: string;
  apexIp: string;
};

async function platformDomainSettings(supabase: any): Promise<PlatformDomainSettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const s = ((data?.settings as any) ?? {}) as Record<string, string>;
  const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
  return {
    rootDomain,
    loginHost: (s.login_host ?? "").toLowerCase(),
    dnsTarget: (s.dns_target ?? `stores.${rootDomain}`).toLowerCase(),
    apexIp: s.apex_ip ?? "185.158.133.1",
  };
}

/** Cloudflare SSL for SaaS is only usable when both secrets are configured. */
function cloudflareConfigured() {
  return Boolean(process.env["CF_API_TOKEN"] && process.env["CF_ZONE_ID"]);
}

// ---------- Store admin ----------

export const listMyDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const settings = await platformDomainSettings(context.supabase);
    const { data } = await context.supabase
      .from("store_domains")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    return {
      store,
      settings,
      autoSsl: cloudflareConfigured(),
      domains: (data ?? []) as any[],
    };
  });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");

export const checkSubdomainAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    if (data.slug === store.slug) return { available: true, current: true, reason: "" };
    if (RESERVED_SLUGS.has(data.slug)) {
      return { available: false, current: false, reason: "This name is reserved" };
    }
    const { data: taken } = await supabase.rpc("is_slug_taken", { _slug: data.slug });
    return {
      available: !taken,
      current: false,
      reason: taken ? "Already taken by another store" : "",
    };
  });

export const updateMySubdomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: slugSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    if (data.slug === store.slug) return { ok: true, slug: store.slug, changed: false };
    if (RESERVED_SLUGS.has(data.slug)) throw new Error("This name is reserved");

    const { data: taken } = await supabase.rpc("is_slug_taken", { _slug: data.slug });
    if (taken) throw new Error("That subdomain is already taken");

    const { error } = await supabase.from("stores").update({ slug: data.slug }).eq("id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true, slug: data.slug, changed: true, previous: store.slug };
  });

export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hostname: string }) =>
    z.object({ hostname: z.string().min(3).max(253) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "custom_domain" as any);
    const store = await requireMyStore(supabase, userId);
    const host = normalizeHost(data.hostname);
    if (!HOSTNAME_RE.test(host)) throw new Error("Invalid hostname format");

    const { rootDomain, loginHost, dnsTarget } = await platformDomainSettings(supabase);
    if (rootDomain && (host === rootDomain || host.endsWith(`.${rootDomain}`))) {
      throw new Error("This hostname is on the platform root — use your subdomain instead.");
    }
    if (loginHost && host === loginHost) throw new Error("Reserved hostname");

    // Cloudflare SSL for SaaS when available; manual DNS verification otherwise.
    let cf: any = null;
    let cfError = "";
    if (cloudflareConfigured()) {
      try {
        const { attachCustomHostname } = await import("./cloudflare-ssl.server");
        cf = await attachCustomHostname(host);
      } catch (e) {
        cfError = (e as Error).message;
      }
    }

    const { data: created, error } = await supabase
      .from("store_domains")
      .insert({
        store_id: store.id,
        hostname: host,
        kind: "custom",
        status: "pending",
        dns_target: dnsTarget,
        verification_method: cf ? "cloudflare" : "dns",
        last_error: cfError || null,
        cf_hostname_id: cf?.id ?? null,
        cf_status: cf?.status ?? null,
        cf_ssl_status: cf?.ssl?.status ?? null,
        cf_ownership: cf?.ownership_verification ?? null,
        cf_ssl_validation: cf?.ssl?.validation_records ?? null,
      })
      .select("*")
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("This domain is already connected to a store");
      }
      throw new Error(error.message);
    }
    return created;
  });

export const checkDomainVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    const { data: row } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.last_checked_at && Date.now() - new Date(row.last_checked_at).getTime() < 15_000) {
      throw new Error("Please wait a few seconds before checking again");
    }

    const { dnsTarget, apexIp } = await platformDomainSettings(supabase);
    const target = (row.dns_target ?? dnsTarget).toLowerCase();
    const { resolveTxt, resolveCname, resolveA, fetchHttpChallenge } = await import(
      "./dns-lookup.server"
    );

    const patch: Record<string, any> = { last_checked_at: new Date().toISOString() };
    let ok = false;
    let reason = "";
    let method = row.verification_method ?? "dns";

    // 1. Cloudflare-managed hostnames: mirror CF's own state.
    if (row.cf_hostname_id && cloudflareConfigured()) {
      try {
        const { getCustomHostname } = await import("./cloudflare-ssl.server");
        const cf = await getCustomHostname(row.cf_hostname_id);
        patch.cf_status = cf.status;
        patch.cf_ssl_status = cf.ssl?.status ?? null;
        patch.cf_ownership = cf.ownership_verification ?? null;
        patch.cf_ssl_validation = cf.ssl?.validation_records ?? null;
        method = "cloudflare";
        if (cf.status === "active" && cf.ssl?.status === "active") {
          ok = true;
          patch.status = "active";
          patch.ssl_status = "issued";
          patch.verified_at = new Date().toISOString();
        } else {
          patch.status = row.status === "active" ? "active" : "pending";
          patch.ssl_status = cf.ssl?.status === "pending_validation" ? "issuing" : row.ssl_status;
          reason =
            cf.verification_errors?.[0] ||
            cf.ssl?.validation_errors?.[0]?.message ||
            `Cloudflare status: ${cf.status} / SSL ${cf.ssl?.status ?? "unknown"}`;
        }
      } catch (e) {
        reason = (e as Error).message;
      }
    }

    // 2. Our own DNS / HTTP verification.
    if (!ok) {
      const [txt, cname, aRecords] = await Promise.all([
        resolveTxt(`_orzen-verify.${row.hostname}`),
        resolveCname(row.hostname),
        resolveA(row.hostname),
      ]);
      const txtOk = txt.some((t) => t === row.verification_token);
      const pointedOk =
        cname.some((c) => c.toLowerCase() === target) ||
        aRecords.includes(apexIp) ||
        (await resolveA(target)).some((ip) => aRecords.includes(ip));

      let ownershipOk = txtOk;
      if (!ownershipOk && pointedOk) {
        // The domain already reaches us — accept the HTTP challenge instead.
        ownershipOk = await fetchHttpChallenge(row.hostname, row.verification_token);
        if (ownershipOk) method = "http";
      }

      if (ownershipOk && pointedOk) {
        ok = true;
        patch.status = row.cf_hostname_id ? (patch.status ?? "pending") : "verified";
        patch.verified_at = new Date().toISOString();
        if (!row.cf_hostname_id) {
          patch.ssl_status = cloudflareConfigured() ? "issuing" : "external";
          patch.status = "verified";
        }
        if (!txtOk) method = "http";
      } else if (!reason) {
        if (!pointedOk) {
          reason = isApex(row.hostname)
            ? `Not pointing to the platform yet — add an A record to ${apexIp} (or a CNAME to ${target} if your DNS supports flattening).`
            : `CNAME for ${row.hostname} is not pointing to ${target} yet.`;
        } else {
          reason = `Ownership record missing — add TXT _orzen-verify.${row.hostname} with your token.`;
        }
      }
    }

    patch.verification_method = method;
    patch.last_error = ok ? null : reason || "Verification failed";
    if (!ok && row.status !== "active") patch.status = patch.status ?? "pending";

    await supabase.from("store_domains").update(patch as never).eq("id", row.id);
    return { ok, reason, status: patch.status ?? row.status };
  });

export const removeDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    const { data: row } = await supabase
      .from("store_domains")
      .select("id, cf_hostname_id")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");

    if (row.cf_hostname_id && cloudflareConfigured()) {
      try {
        const { detachCustomHostname } = await import("./cloudflare-ssl.server");
        await detachCustomHostname(row.cf_hostname_id);
      } catch {
        // Detaching is best-effort — never block removal on the CF API.
      }
    }
    await supabase.from("stores").update({ primary_domain_id: null }).eq("primary_domain_id", row.id);
    const { error } = await supabase.from("store_domains").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Pass domainId = null to fall back to the subdomain.
export const setPrimaryDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string | null }) =>
    z.object({ domainId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    // Clear existing primary flags
    await supabase.from("store_domains").update({ is_primary: false }).eq("store_id", store.id);
    if (data.domainId) {
      const { data: row } = await supabase
        .from("store_domains")
        .select("id, store_id, status")
        .eq("id", data.domainId)
        .maybeSingle();
      if (!row || row.store_id !== store.id) throw new Error("Not found");
      if (!["verified", "active"].includes(row.status)) {
        throw new Error("Domain must be verified before it can be primary");
      }
      await supabase.from("store_domains").update({ is_primary: true }).eq("id", row.id);
      await supabase.from("stores").update({ primary_domain_id: row.id }).eq("id", store.id);
    } else {
      await supabase.from("stores").update({ primary_domain_id: null }).eq("id", store.id);
    }
    return { ok: true };
  });

// ---------- Owner (platform-wide) ----------

export const listAllDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_domains")
      .select("*, stores(name, slug)")
      .order("created_at", { ascending: false });
    return (data ?? []) as any[];
  });

export const setDomainSslStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string; ssl_status: string; activate?: boolean }) =>
    z
      .object({
        domainId: z.string().uuid(),
        ssl_status: z.enum(["none", "issuing", "issued", "failed", "external"]),
        activate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const patch: any = { ssl_status: data.ssl_status };
    if (data.activate && ["issued", "external"].includes(data.ssl_status)) patch.status = "active";
    const { error } = await context.supabase.from("store_domains").update(patch).eq("id", data.domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerRemoveDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    await context.supabase.from("stores").update({ primary_domain_id: null }).eq("primary_domain_id", data.domainId);
    const { error } = await context.supabase.from("store_domains").delete().eq("id", data.domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner platform routing health ----------

export const platformDomainHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context.supabase, context.userId);
    const { rootDomain, loginHost, dnsTarget, apexIp } = await platformDomainSettings(
      context.supabase,
    );
    const { resolveA, resolveCname } = await import("./dns-lookup.server");

    const probe = `wildcard-probe-${Date.now().toString(36)}.${rootDomain}`;
    const [rootA, wildcardA, wildcardCname, targetA, targetCname, loginA] = await Promise.all([
      resolveA(rootDomain),
      resolveA(probe),
      resolveCname(probe),
      dnsTarget ? resolveA(dnsTarget) : Promise.resolve([]),
      dnsTarget ? resolveCname(dnsTarget) : Promise.resolve([]),
      loginHost ? resolveA(loginHost) : Promise.resolve([]),
    ]);

    return {
      rootDomain,
      loginHost,
      dnsTarget,
      apexIp,
      cloudflareConfigured: cloudflareConfigured(),
      rootResolves: rootA.length > 0,
      wildcardResolves: wildcardA.length > 0 || wildcardCname.length > 0,
      fallbackOriginResolves: targetA.length > 0 || targetCname.length > 0,
      loginHostResolves: loginHost ? loginA.length > 0 : true,
      records: { rootA, wildcardA, wildcardCname, targetA, targetCname, loginA },
      checkedAt: new Date().toISOString(),
    };
  });

// ---------- DNS diagnostics ----------


export const checkDnsResolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hostname?: string }) =>
    z.object({ hostname: z.string().min(1).max(253).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);
    const { rootDomain, dnsTarget, apexIp } = await platformDomainSettings(supabase);

    const host = data.hostname ? normalizeHost(data.hostname) : `${store.slug}.${rootDomain}`;
    const { resolveA, resolveCname } = await import("./dns-lookup.server");

    const [aList, wildcardList, cnameList, rootA, dnsTargetA] = await Promise.all([
      resolveA(host),
      resolveA(`wildcard-probe-${Date.now().toString(36)}.${rootDomain}`),
      resolveCname(host),
      resolveA(rootDomain),
      resolveA(dnsTarget),
    ]);

    const platformIps = new Set([apexIp, ...rootA, ...dnsTargetA]);

    return {
      host,
      rootDomain,
      dnsTarget,
      expectedIp: apexIp,
      hostResolves: aList.length > 0 || cnameList.length > 0,
      pointsToPlatform:
        aList.some((ip) => platformIps.has(ip)) ||
        cnameList.some((c) => c.toLowerCase() === dnsTarget),
      wildcardWorks: wildcardList.length > 0,
      wildcardCorrect: wildcardList.some((ip) => platformIps.has(ip)),
      records: {
        a: aList,
        cname: cnameList,
        wildcardProbe: wildcardList,
        rootA,
        dnsTargetA,
      },
      errors: { a: null, cname: null, wildcard: null, root: null, dnsTarget: null },
      checkedAt: new Date().toISOString(),
    };
  });

// ---------- Host-based routing resolver ----------
// Reads the incoming request Host header and maps it to a store slug.
// Used by the landing/auth loaders so that hitting a store's custom domain
// or store subdomain (e.g. mystore.example.com or mystore.orzen.top) opens
// the storefront directly instead of the marketing landing page.

function publicSbClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const resolveHost = createServerFn({ method: "GET" }).handler(async () => {
  let host = "";
  try {
    const req = getRequest();
    host = (req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  } catch {
    // no request context (client nav) — nothing to resolve
    return { host: "", slug: null as string | null, isPlatform: true };
  }
  if (!host) return { host: "", slug: null, isPlatform: true };

  // Hosting-provided hosts (workers.dev / pages.dev / preview / local) always
  // render the main platform site — never treat them as a store subdomain.
  const isEphemeral =
    host === "localhost" ||
    host.endsWith(".workers.dev") ||
    host.endsWith(".pages.dev") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sslip.io");
  if (isEphemeral) return { host, slug: null, isPlatform: true };

  // Any failure below (missing env, DB unreachable) must fall back to the
  // platform site rather than crashing the whole request.
  try {
    const sb = publicSbClient();
    const { data: pSettings } = await sb
      .from("platform_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    const s = ((pSettings?.settings as any) ?? {}) as Record<string, string>;
    const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
    const loginHost = (s.login_host ?? "").toLowerCase();
    const dnsTarget = (s.dns_target ?? "").toLowerCase();

    const platformHosts = new Set(
      [rootDomain, `www.${rootDomain}`, loginHost, dnsTarget].filter(Boolean),
    );

    if (platformHosts.has(host)) {
      return { host, slug: null, isPlatform: true };
    }

    // <slug>.<root_domain>
    if (host.endsWith(`.${rootDomain}`)) {
      const slug = host.slice(0, -(rootDomain.length + 1));
      if (slug && !slug.includes(".") && !RESERVED_SLUGS.has(slug)) {
        return { host, slug, isPlatform: false };
      }
      return { host, slug: null, isPlatform: true };
    }


    // Custom domain lookup
    const { data: resolved } = await sb.rpc("resolve_domain", { _host: host });
    const r = resolved as any;
    if (r && r.slug) return { host, slug: r.slug as string, isPlatform: false };
  } catch {
    return { host, slug: null, isPlatform: true };
  }

  return { host, slug: null, isPlatform: true };
});
