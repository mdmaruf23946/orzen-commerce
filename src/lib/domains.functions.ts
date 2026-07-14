// Domain management server functions.
// Store-scoped: subdomain edit + custom domain lifecycle + primary selection.
// Owner-scoped: platform-wide domain view + settings.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";


const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeHost(h: string) {
  return h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
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

// ---------- Store admin ----------

export const listMyDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_domains")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    return { store, domains: (data ?? []) as any[] };
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

    // Reject platform / login host reuse
    const { data: pSettings } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    const s = (pSettings?.settings as any) ?? {};
    const rootDomain = (s.root_domain ?? "").toLowerCase();
    const loginHost = (s.login_host ?? "").toLowerCase();
    const dnsTarget = s.dns_target ?? (rootDomain ? `stores.${rootDomain}` : "stores.orzen.top");
    if (rootDomain && (host === rootDomain || host.endsWith(`.${rootDomain}`))) {
      throw new Error("This hostname is on the platform root — use your subdomain instead.");
    }
    if (loginHost && host === loginHost) throw new Error("Reserved hostname");

    const { data: created, error } = await supabase
      .from("store_domains")
      .insert({ store_id: store.id, hostname: host, kind: "custom", status: "pending", dns_target: dnsTarget })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const checkDomainVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.last_checked_at && Date.now() - new Date(row.last_checked_at).getTime() < 30_000) {
      throw new Error("Please wait a few seconds before checking again");
    }
    const { promises: dns } = await import("dns");
    let ok = false;
    let reason = "";
    try {
      const txtRecs = await dns.resolveTxt(`_orzen-verify.${row.hostname}`).catch(() => []);
      const flat = txtRecs.map((r) => r.join("")).map((s) => s.trim());
      const txtOk = flat.includes(row.verification_token);
      const cnameRecs = await dns.resolveCname(row.hostname).catch(() => [] as string[]);
      const cnameOk = row.dns_target
        ? cnameRecs.some((c) => c.toLowerCase().replace(/\.$/, "") === row.dns_target!.toLowerCase())
        : true;
      ok = txtOk && cnameOk;
      if (!txtOk) reason = "TXT record missing or wrong";
      else if (!cnameOk) reason = "CNAME not pointing to platform";
    } catch (e) {
      reason = (e as Error).message;
    }
    const patch: any = { last_checked_at: new Date().toISOString() };
    if (ok) {
      patch.status = "verified";
      patch.verified_at = new Date().toISOString();
      patch.ssl_status = "issuing";
    } else if (row.status === "pending") {
      patch.status = "pending";
    }
    await supabase.from("store_domains").update(patch).eq("id", row.id);
    return { ok, reason };
  });

export const removeDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domainId: string }) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // If it's currently primary, clear stores.primary_domain_id first
    await supabase.from("stores").update({ primary_domain_id: null }).eq("primary_domain_id", data.domainId);
    const { error } = await supabase.from("store_domains").delete().eq("id", data.domainId);
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
        ssl_status: z.enum(["none", "issuing", "issued", "failed"]),
        activate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const patch: any = { ssl_status: data.ssl_status };
    if (data.activate && data.ssl_status === "issued") patch.status = "active";
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

// ---------- DNS diagnostics ----------

export const checkDnsResolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hostname?: string }) =>
    z.object({ hostname: z.string().min(1).max(253).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await requireMyStore(supabase, userId);

    const { data: pSettings } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    const s = (pSettings?.settings as any) ?? {};
    const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
    const dnsTarget = (s.dns_target ?? `stores.${rootDomain}`).toLowerCase();
    const expectedIp = "185.158.133.1";

    const host = data.hostname
      ? normalizeHost(data.hostname)
      : `${store.slug}.${rootDomain}`;

    const { promises: dns } = await import("dns");
    const safe = async <T,>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
      try { return { ok: true, value: await p }; }
      catch (e) { return { ok: false, error: (e as Error).message }; }
    };

    const [aHost, aWildcardProbe, cnameHost, aRoot, aDnsTarget] = await Promise.all([
      safe(dns.resolve4(host)),
      safe(dns.resolve4(`wildcard-probe-${Date.now().toString(36)}.${rootDomain}`)),
      safe(dns.resolveCname(host)),
      safe(dns.resolve4(rootDomain)),
      safe(dns.resolve4(dnsTarget)),
    ]);

    const aList = aHost.ok ? aHost.value : [];
    const wildcardList = aWildcardProbe.ok ? aWildcardProbe.value : [];
    const cnameList = cnameHost.ok ? cnameHost.value : [];

    return {
      host,
      rootDomain,
      dnsTarget,
      expectedIp,
      hostResolves: aList.length > 0 || cnameList.length > 0,
      pointsToPlatform: aList.includes(expectedIp),
      wildcardWorks: wildcardList.length > 0,
      wildcardCorrect: wildcardList.includes(expectedIp),
      records: {
        a: aList,
        cname: cnameList,
        wildcardProbe: wildcardList,
        rootA: aRoot.ok ? aRoot.value : [],
        dnsTargetA: aDnsTarget.ok ? aDnsTarget.value : [],
      },
      errors: {
        a: aHost.ok ? null : aHost.error,
        cname: cnameHost.ok ? null : cnameHost.error,
        wildcard: aWildcardProbe.ok ? null : aWildcardProbe.error,
        root: aRoot.ok ? null : aRoot.error,
        dnsTarget: aDnsTarget.ok ? null : aDnsTarget.error,
      },
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

  const sb = publicSbClient();
  const { data: pSettings } = await sb
    .from("platform_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const s = ((pSettings?.settings as any) ?? {}) as Record<string, string>;
  const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
  const loginHost = (s.login_host ?? "").toLowerCase();

  const platformHosts = new Set(
    [rootDomain, `www.${rootDomain}`, loginHost].filter(Boolean),
  );
  const isEphemeral =
    host === "localhost" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sslip.io");

  if (isEphemeral || platformHosts.has(host)) {
    return { host, slug: null, isPlatform: true };
  }

  // <slug>.<root_domain>
  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.slice(0, -(rootDomain.length + 1));
    if (slug && !slug.includes(".") && slug !== "www") {
      return { host, slug, isPlatform: false };
    }
  }

  // Custom domain lookup
  const { data: resolved } = await sb.rpc("resolve_domain", { _host: host });
  const r = resolved as any;
  if (r && r.slug) return { host, slug: r.slug as string, isPlatform: false };

  return { host, slug: null, isPlatform: true };
});

