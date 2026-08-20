// Store Admin server functions for the Landing Page builder.
// Landing pages hold their own content snapshot and their own domains; the
// source product and the storefront are never modified from here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaultFormConfig,
  defaultTheme,
  generateContentFromProduct,
  RESERVED_LP_SLUGS,
  slugify,
  type SourceProduct,
} from "@/lib/landing-builder";

const uuid = z.string().uuid();

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;

function normalizeHost(h: string) {
  return h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

async function requireMyStore(supabase: any, userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id, slug, name")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No store found for this account");
  return data as { id: string; slug: string; name: string };
}

async function ownedPage(supabase: any, storeId: string, id: string) {
  const { data } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) throw new Error("Landing page not found");
  return data as any;
}

async function platformHosts(supabase: any) {
  const { data } = await supabase.from("platform_settings").select("settings").eq("id", 1).maybeSingle();
  const s = ((data?.settings as any) ?? {}) as Record<string, string>;
  const rootDomain = (s.root_domain ?? "orzen.top").toLowerCase();
  return {
    rootDomain,
    dnsTarget: (s.dns_target ?? `stores.${rootDomain}`).toLowerCase(),
    apexIp: s.apex_ip ?? "185.158.133.1",
  };
}

async function uniqueSlug(supabase: any, base: string) {
  const root = slugify(base) || "landing";
  let candidate = root;
  for (let i = 0; i < 40; i++) {
    const { data: taken } = await supabase.rpc("is_landing_slug_taken", { _slug: candidate });
    if (!taken && !RESERVED_LP_SLUGS.has(candidate)) return candidate;
    candidate = `${root}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("Could not generate a unique URL");
}

// ---------- Reads ----------

export const listLandingPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: pages, error } = await context.supabase
      .from("landing_pages")
      .select("id,slug,title,status,product_id,views,orders_count,published_at,updated_at,created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (pages ?? []).map((p: any) => p.id);
    const productIds = (pages ?? []).map((p: any) => p.product_id).filter(Boolean);

    const [domainsRes, productsRes, hosts] = await Promise.all([
      ids.length
        ? context.supabase
            .from("landing_page_domains")
            .select("id,landing_page_id,hostname,kind,status")
            .in("landing_page_id", ids)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? context.supabase.from("products").select("id,name,primary_image_url").in("id", productIds)
        : Promise.resolve({ data: [] }),
      platformHosts(context.supabase),
    ]);

    const byPage = new Map<string, any[]>();
    for (const d of (domainsRes.data ?? []) as any[]) {
      byPage.set(d.landing_page_id, [...(byPage.get(d.landing_page_id) ?? []), d]);
    }
    const products = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

    return {
      rootDomain: hosts.rootDomain,
      pages: (pages ?? []).map((p: any) => ({
        ...p,
        product: products.get(p.product_id) ?? null,
        domains: byPage.get(p.id) ?? [],
      })),
    };
  });

export const getLandingPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const [domainsRes, productRes, hosts] = await Promise.all([
      context.supabase
        .from("landing_page_domains")
        .select("*")
        .eq("landing_page_id", page.id)
        .order("created_at", { ascending: true }),
      page.product_id
        ? context.supabase
            .from("products")
            .select("id,name,price,old_price,stock,status,primary_image_url")
            .eq("id", page.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      platformHosts(context.supabase),
    ]);
    return {
      page,
      product: productRes.data ?? null,
      domains: domainsRes.data ?? [],
      rootDomain: hosts.rootDomain,
      dnsTarget: hosts.dnsTarget,
      apexIp: hosts.apexIp,
    };
  });

export const listLandingProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("products")
      .select("id,name,price,old_price,primary_image_url,stock,status,product_type")
      .eq("store_id", store.id)
      .eq("product_type", "physical")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Create / update ----------

async function loadSourceProduct(supabase: any, storeId: string, productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,price,old_price,short_description,description,primary_image_url,gallery,features,specifications,warranty,shipping_info,return_policy,delivery_time_days",
    )
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Product not found");
  return data as SourceProduct;
}

export const createLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ productId: uuid, title: z.string().trim().max(120).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const product = await loadSourceProduct(context.supabase, store.id, data.productId);
    const title = data.title?.trim() || product.name;
    const slug = await uniqueSlug(context.supabase, title);

    const { data: created, error } = await context.supabase
      .from("landing_pages")
      .insert({
        store_id: store.id,
        product_id: product.id,
        slug,
        title,
        status: "draft",
        content: generateContentFromProduct(product) as any,
        theme: defaultTheme() as any,
        form_config: defaultFormConfig() as any,
        seo: {
          title: `${title} — ${store.name}`,
          description: (product.short_description ?? "").slice(0, 160),
        } as any,
        synced_at: new Date().toISOString(),
      })
      .select("id,slug")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        title: z.string().trim().min(1).max(120).optional(),
        slug: z.string().trim().max(48).optional(),
        content: z.record(z.string(), z.any()).optional(),
        theme: z.record(z.string(), z.any()).optional(),
        form_config: z.record(z.string(), z.any()).optional(),
        seo: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.content !== undefined) patch["content"] = data.content;
    if (data.theme !== undefined) patch["theme"] = data.theme;
    if (data.form_config !== undefined) patch["form_config"] = data.form_config;
    if (data.seo !== undefined) patch["seo"] = data.seo;

    if (data.slug !== undefined) {
      const next = slugify(data.slug);
      if (!next || next.length < 3) throw new Error("URL must be at least 3 characters");
      if (RESERVED_LP_SLUGS.has(next)) throw new Error("This URL is reserved");
      if (next !== page.slug) {
        const { data: taken } = await context.supabase.rpc("is_landing_slug_taken", { _slug: next });
        if (taken) throw new Error("This URL is already taken");
        patch["slug"] = next;
      }
    }

    const { error } = await context.supabase
      .from("landing_pages")
      .update(patch as never)
      .eq("id", page.id);
    if (error) throw new Error(error.message);
    return { ok: true, slug: (patch["slug"] as string) ?? page.slug };
  });

export const setLandingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, status: z.enum(["draft", "published"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    if (data.status === "published" && !page.product_id) {
      throw new Error("This page has no product — cannot publish");
    }
    const { error } = await context.supabase
      .from("landing_pages")
      .update({
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : page.published_at,
      } as never)
      .eq("id", page.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const title = `${page.title} (copy)`;
    const slug = await uniqueSlug(context.supabase, title);
    const { data: created, error } = await context.supabase
      .from("landing_pages")
      .insert({
        store_id: store.id,
        product_id: page.product_id,
        slug,
        title,
        status: "draft",
        content: page.content,
        theme: page.theme,
        form_config: page.form_config,
        seo: page.seo,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    await ownedPage(context.supabase, store.id, data.id);
    const { error } = await context.supabase.from("landing_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Explicit, admin-triggered re-sync of content from the source product. */
export const resyncLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    if (!page.product_id) throw new Error("This page has no source product");
    const product = await loadSourceProduct(context.supabase, store.id, page.product_id);
    const { error } = await context.supabase
      .from("landing_pages")
      .update({
        content: generateContentFromProduct(product) as any,
        synced_at: new Date().toISOString(),
      } as never)
      .eq("id", page.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Domains ----------

export const setLandingSubdomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, label: z.string().trim().min(3).max(48) }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const label = slugify(data.label);
    if (!LABEL_RE.test(label)) throw new Error("Use 3-48 letters, numbers or hyphens");
    if (RESERVED_LP_SLUGS.has(label)) throw new Error("This subdomain is reserved");

    const { rootDomain } = await platformHosts(context.supabase);
    const hostname = `${label}.${rootDomain}`;

    const [{ data: storeClash }, { data: existing }] = await Promise.all([
      context.supabase.from("stores").select("id").eq("slug", label).maybeSingle(),
      context.supabase
        .from("landing_page_domains")
        .select("id")
        .eq("landing_page_id", page.id)
        .eq("kind", "subdomain")
        .maybeSingle(),
    ]);
    if (storeClash) throw new Error("A store already uses this subdomain");

    const payload = {
      landing_page_id: page.id,
      store_id: store.id,
      hostname,
      kind: "subdomain",
      status: "active",
      ssl_status: "issued",
      verified_at: new Date().toISOString(),
    };

    const res = existing
      ? await context.supabase.from("landing_page_domains").update(payload as never).eq("id", existing.id)
      : await context.supabase.from("landing_page_domains").insert(payload as never);
    if (res.error) {
      if (/duplicate|unique/i.test(res.error.message)) throw new Error("This subdomain is already taken");
      throw new Error(res.error.message);
    }
    return { hostname };
  });

export const addLandingCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, hostname: z.string().min(3).max(253) }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const host = normalizeHost(data.hostname);
    if (!HOSTNAME_RE.test(host)) throw new Error("Invalid hostname format");

    const { rootDomain, dnsTarget } = await platformHosts(context.supabase);
    if (host === rootDomain || host.endsWith(`.${rootDomain}`)) {
      throw new Error("This hostname is on the platform root — use the subdomain option instead.");
    }

    let cf: any = null;
    let cfError = "";
    if (process.env["CF_API_TOKEN"] && process.env["CF_ZONE_ID"]) {
      try {
        const { attachCustomHostname } = await import("./cloudflare-ssl.server");
        cf = await attachCustomHostname(host);
      } catch (e) {
        cfError = (e as Error).message;
      }
    }

    const { data: created, error } = await context.supabase
      .from("landing_page_domains")
      .insert({
        landing_page_id: page.id,
        store_id: store.id,
        hostname: host,
        kind: "custom",
        status: "pending",
        dns_target: dnsTarget,
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
      if (/duplicate|unique/i.test(error.message)) throw new Error("This domain is already connected");
      throw new Error(error.message);
    }
    return created;
  });

export const verifyLandingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("landing_page_domains")
      .select("*")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.last_checked_at && Date.now() - new Date(row.last_checked_at).getTime() < 15_000) {
      throw new Error("Please wait a few seconds before checking again");
    }

    const { dnsTarget, apexIp } = await platformHosts(context.supabase);
    const target = (row.dns_target ?? dnsTarget).toLowerCase();
    const { resolveTxt, resolveCname, resolveA } = await import("./dns-lookup.server");

    const [txt, cname, aRecords] = await Promise.all([
      resolveTxt(`_orzen-verify.${row.hostname}`),
      resolveCname(row.hostname),
      resolveA(row.hostname),
    ]);
    const txtOk = txt.some((t) => t === row.verification_token);
    const pointedOk =
      cname.some((c) => c.toLowerCase() === target) || aRecords.includes(apexIp);

    const patch: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
    let reason = "";
    const ok = txtOk && pointedOk;
    if (ok) {
      patch["status"] = "verified";
      patch["ssl_status"] = "issuing";
      patch["verified_at"] = new Date().toISOString();
      patch["last_error"] = null;
    } else {
      reason = !pointedOk
        ? `Point ${row.hostname} to ${target} (CNAME) or ${apexIp} (A record).`
        : `Add TXT record _orzen-verify.${row.hostname} with value ${row.verification_token}.`;
      patch["last_error"] = reason;
    }

    await context.supabase.from("landing_page_domains").update(patch as never).eq("id", row.id);
    return { ok, reason };
  });

export const removeLandingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("landing_page_domains")
      .select("id,cf_hostname_id")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.cf_hostname_id && process.env["CF_API_TOKEN"] && process.env["CF_ZONE_ID"]) {
      try {
        const { detachCustomHostname } = await import("./cloudflare-ssl.server");
        await detachCustomHostname(row.cf_hostname_id);
      } catch {
        /* keep going — the DB row must still be removed */
      }
    }
    const { error } = await context.supabase.from("landing_page_domains").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
