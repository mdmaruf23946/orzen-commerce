// Store Admin server functions for the Landing Page builder.
// Landing pages hold their own content snapshot and their own domains; the
// source product and the storefront are never modified from here.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlan, assertLimit } from "@/lib/plan-guard";
import {
  defaultFormConfig,
  defaultTheme,
  generateContentFromProduct,
  RESERVED_LP_SLUGS,
  slugify,
  type SourceProduct,
} from "@/lib/landing-builder";

const uuid = z.string().uuid();

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;


async function requireMyStore(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id, slug, name", "landing_builder");
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

/**
 * Canonical public URL of a landing page. A landing page must never be linked
 * as a path on the platform site (orzen.top/lp/<slug>): that URL is inside the
 * platform PWA scope, so on a device with the ORZEN app installed the page
 * opens *inside* the ORZEN app (ORZEN splash + icon). Its own host keeps the
 * page a separate, independently installable app.
 */
function landingPublicUrl(customDomains: any[], subdomains: any[]): string | null {
  const custom = (customDomains ?? [])
    .filter((d) => ["verified", "active"].includes(String(d.status)))
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))[0];
  if (custom) return `https://${String(custom.hostname).toLowerCase()}`;
  const sub = (subdomains ?? []).find(
    (d) => d.kind === "subdomain" || ["verified", "active"].includes(String(d.status)),
  );
  return sub ? `https://${String(sub.hostname).toLowerCase()}` : null;
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

    const [domainsRes, customRes, productsRes, hosts] = await Promise.all([
      ids.length
        ? context.supabase
            .from("landing_page_domains")
            .select("id,landing_page_id,hostname,kind,status")
            .in("landing_page_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? context.supabase
            .from("store_domains")
            .select("id,landing_page_id,hostname,status,is_primary")
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
    const customByPage = new Map<string, any[]>();
    for (const d of (customRes.data ?? []) as any[]) {
      customByPage.set(d.landing_page_id, [...(customByPage.get(d.landing_page_id) ?? []), d]);
    }
    const products = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

    return {
      rootDomain: hosts.rootDomain,
      pages: (pages ?? []).map((p: any) => ({
        ...p,
        product: products.get(p.product_id) ?? null,
        domains: byPage.get(p.id) ?? [],
        customDomains: customByPage.get(p.id) ?? [],
        publicUrl: landingPublicUrl(customByPage.get(p.id) ?? [], byPage.get(p.id) ?? []),
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
            .select("id,name,price,old_price,stock,status,primary_image_url,gallery")
            .eq("id", page.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      platformHosts(context.supabase),
    ]);
    const { data: storeInfo } = await context.supabase
      .from("stores")
      .select(
        "id,name,slug,logo_url,name_logo_url,phone,whatsapp,email,address,facebook,instagram,youtube,tiktok",
      )
      .eq("id", store.id)
      .maybeSingle();
    const { data: storeZones } = await context.supabase
      .from("delivery_zones")
      .select("id,name,charge,is_default,sort_order")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true });
    // Custom domains connected in Domain settings and attached to this page.
    const { data: attached } = await context.supabase
      .from("store_domains")
      .select("id,hostname,status,ssl_status,last_error,dns_target")
      .eq("store_id", store.id)
      .eq("landing_page_id", page.id)
      .order("hostname", { ascending: true });
    const { subdomainAutomationConfigured } = await import("@/lib/cloudflare-pages.server");
    return {
      page,
      product: productRes.data ?? null,
      store: storeInfo ?? { id: store.id },
      storeZones: storeZones ?? [],
      domains: domainsRes.data ?? [],
      attachedDomains: attached ?? [],
      autoSubdomain: subdomainAutomationConfigured(),
      publicUrl: landingPublicUrl((attached ?? []) as any[], (domainsRes.data ?? []) as any[]),
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
    z
      .object({
        productId: uuid,
        title: z.string().trim().max(120).optional(),
        /** Generate the copy with AI before creating the page. */
        useAi: z.boolean().optional(),
        /** Output language for the AI-generated copy. */
        contentLang: z.enum(["en", "bn", "mixed"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "landing_page_create");
    await assertLimit(context.supabase, context.userId, "landing_page");
    const store = await requireMyStore(context.supabase, context.userId);
    const product = await loadSourceProduct(context.supabase, store.id, data.productId);
    const title = data.title?.trim() || product.name;
    const slug = await uniqueSlug(context.supabase, title);

    let content = generateContentFromProduct(product);
    let seo: { title: string; description: string } = {
      title: `${title} — ${store.name}`.slice(0, 70),
      description: (product.short_description ?? "").slice(0, 160),
    };

    if (data.useAi) {
      try {
        const { data: reviewRows } = await context.supabase
          .from("product_reviews")
          .select("name,rating,comment,created_at")
          .eq("store_id", store.id)
          .eq("product_id", product.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(6);

        const reviews = (reviewRows ?? []).map((r: any) => ({
          name: String(r.name ?? "").slice(0, 60),
          location: "",
          rating: Number(r.rating) || 5,
          text: String(r.comment ?? "").slice(0, 400),
          photo: "",
        }));

        const { generateLandingCopy, seoFromContent } = await import("@/lib/landing-ai.server");
        const generated = await generateLandingCopy(content, {
          product,
          storeName: store.name,
          reviews,
          hasRealReviews: reviews.length > 0,
        }, data.contentLang ?? "en");
        if (generated) {
          content = generated;
          seo = seoFromContent(generated, title, store.name);
        }
      } catch (e) {
        // AI is best-effort: fall back to the template content.
        console.warn("Landing AI generation skipped:", (e as Error).message);
      }
    }

    // Generate the AI color palettes ONCE, here at creation. They are stored
    // with the page and reused forever after, so the Design tab never shuffles.
    let theme: Record<string, unknown> = defaultTheme() as any;
    try {
      const { suggestThemes } = await import("@/lib/landing-theme.server");
      const gallery = Array.isArray((product as any).gallery)
        ? (product as any).gallery
            .map((g: any) => (typeof g === "string" ? g : String(g?.url ?? "")))
            .filter(Boolean)
        : [];
      const presets = await suggestThemes({
        name: product.name,
        category: null,
        description: (product as any).short_description || (product as any).description || null,
        images: [(product as any).primary_image_url, ...gallery].filter(Boolean).slice(0, 4),
      });
      const first = presets[0];
      theme = {
        ...theme,
        presets,
        presetsAt: new Date().toISOString(),
        ...(first
          ? {
              primary: first.primary,
              secondary: first.secondary,
              accent: first.accent,
              background: first.background,
              text: first.text,
              themeId: first.id,
              themeName: first.name,
            }
          : {}),
      };
    } catch (e) {
      console.warn("Landing theme generation skipped:", (e as Error).message);
    }

    const { data: created, error } = await context.supabase
      .from("landing_pages")
      .insert({
        store_id: store.id,
        product_id: product.id,
        slug,
        title,
        status: "draft",
        content: content as any,
        theme: theme as any,
        form_config: defaultFormConfig() as any,
        seo: seo as any,
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

/**
 * Owner-only preview of a landing page by slug — works for drafts too, so the
 * merchant can see the page before publishing it publicly.
 */
export const getLandingPreviewBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: page } = await context.supabase
      .from("landing_pages")
      .select("*")
      .eq("store_id", store.id)
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!page) return null;

    const { data: product } = page.product_id
      ? await context.supabase
          .from("products")
          .select("id,name,price,old_price,stock,status")
          .eq("id", page.product_id)
          .maybeSingle()
      : { data: null };

    return {
      id: page.id,
      store_id: page.store_id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      theme: page.theme,
      design_code: page.design_code ?? null,
      form_config: page.form_config,
      seo: page.seo ?? null,
      product: product ?? null,
      store: { id: store.id, name: store.name, slug: store.slug },
    };
  });

/**
 * Save the page's frontend design code (CSS only — the "Coding" tab).
 * Content, orders, payments and settings are never touched from here.
 */
export const setLandingDesignCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, code: z.string().max(120_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const { validateDesignCode } = await import("@/lib/landing-code");
    const check = validateDesignCode(data.code);
    if (!check.ok) throw new Error(check.error);
    const { error } = await context.supabase
      .from("landing_pages")
      .update({
        design_code: check.css || null,
        design_code_at: new Date().toISOString(),
      } as never)
      .eq("id", page.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * AI repair for broken design code. Returns corrected CSS only — it never
 * writes to the page, so the merchant still decides whether to save it.
 */
export const fixLandingDesignCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        code: z.string().max(120_000),
        error: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const { normalizeContent } = await import("@/lib/landing-builder");
    const content = normalizeContent(page.content);
    const sections = content.sectionOrder.filter((k) => content.sectionEnabled[k] !== false);
    const { fixDesignCode } = await import("@/lib/landing-code.server");
    const fixed = await fixDesignCode(data.code, data.error ?? "", sections);
    if (!fixed) throw new Error("AI could not repair this code. Please fix it manually or reset to default.");
    return { code: fixed };
  });

/** Link (or re-link) a landing page to one of the store's products. */

export const setLandingProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, productId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const product = await loadSourceProduct(context.supabase, store.id, data.productId);
    const { error } = await context.supabase
      .from("landing_pages")
      .update({ product_id: product.id } as never)
      .eq("id", page.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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

    // A published page must be reachable on its own host so it never opens
    // inside the platform app. Register <slug>.<root> when nothing is attached.
    if (data.status === "published") {
      await ensureLandingHost(context.supabase, store.id, page).catch(() => null);
    }
    return { ok: true };
  });

/** Give a published page its own hostname when it has none yet. */
async function ensureLandingHost(supabase: any, storeId: string, page: any) {
  const [{ data: sub }, { data: custom }] = await Promise.all([
    supabase.from("landing_page_domains").select("id").eq("landing_page_id", page.id).maybeSingle(),
    supabase.from("store_domains").select("id").eq("landing_page_id", page.id).maybeSingle(),
  ]);
  if (sub || custom) return;

  const { rootDomain } = await platformHosts(supabase);
  let label = slugify(page.slug);
  if (!LABEL_RE.test(label) || RESERVED_LP_SLUGS.has(label)) return;

  const [{ data: storeClash }, { data: hostClash }] = await Promise.all([
    supabase.from("stores").select("id").eq("slug", label).maybeSingle(),
    supabase.from("landing_page_domains").select("id").eq("hostname", `${label}.${rootDomain}`).maybeSingle(),
  ]);
  if (storeClash || hostClash) {
    label = `${label}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const hostname = `${label}.${rootDomain}`;
  const cf = await attachSubdomainToCloudflare(hostname).catch((e) => ({
    status: "error",
    error: (e as Error).message,
  }));
  await supabase.from("landing_page_domains").insert({
    landing_page_id: page.id,
    store_id: storeId,
    hostname,
    kind: "subdomain",
    status: cf.status,
    ssl_status: cf.status === "active" ? "issued" : "issuing",
    last_error: cf.error ?? null,
    last_checked_at: new Date().toISOString(),
    verified_at: cf.status === "active" ? new Date().toISOString() : null,
  } as never);
}

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

/** Register (or refresh) a landing subdomain as a Cloudflare Worker hostname. */
async function attachSubdomainToCloudflare(hostname: string, previous?: string | null) {
  const { ensureSubdomainAttached, detachSubdomain, subdomainAutomationConfigured } = await import(
    "@/lib/cloudflare-pages.server"
  );
  if (!subdomainAutomationConfigured()) {
    return { status: "pending", error: "Cloudflare automation is not configured on this platform yet." };
  }
  const res = await ensureSubdomainAttached(hostname);
  if (previous && previous !== hostname) {
    await detachSubdomain(previous).catch(() => null);
  }
  return res.ok
    ? { status: "active", error: null as string | null }
    : { status: "error", error: res.error ?? "Cloudflare could not attach this subdomain." };
}

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

    const [{ data: storeClash }, { data: existing }, { data: hostClash }] = await Promise.all([
      context.supabase.from("stores").select("id").eq("slug", label).maybeSingle(),
      context.supabase
        .from("landing_page_domains")
        .select("id,hostname")
        .eq("landing_page_id", page.id)
        .eq("kind", "subdomain")
        .maybeSingle(),
      context.supabase
        .from("landing_page_domains")
        .select("id,landing_page_id")
        .eq("hostname", hostname)
        .maybeSingle(),
    ]);
    if (storeClash) throw new Error("A store already uses this subdomain");
    if (hostClash && hostClash.landing_page_id !== page.id) {
      throw new Error("Another landing page already uses this subdomain");
    }

    const cf = await attachSubdomainToCloudflare(hostname, existing?.hostname ?? null).catch((e) => ({
      status: "error",
      error: (e as Error).message,
    }));

    const payload = {
      landing_page_id: page.id,
      store_id: store.id,
      hostname,
      kind: "subdomain",
      status: cf.status,
      ssl_status: cf.status === "active" ? "issued" : "issuing",
      last_error: cf.error ?? null,
      last_checked_at: new Date().toISOString(),
      verified_at: cf.status === "active" ? new Date().toISOString() : null,
    };

    const res = existing
      ? await context.supabase.from("landing_page_domains").update(payload as never).eq("id", existing.id)
      : await context.supabase.from("landing_page_domains").insert(payload as never);
    if (res.error) {
      if (/duplicate|unique/i.test(res.error.message)) throw new Error("This subdomain is already taken");
      throw new Error(res.error.message);
    }
    return { hostname, status: cf.status, error: cf.error ?? null };
  });

/** Retry the Cloudflare attachment for an existing landing subdomain. */
export const retryLandingSubdomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("landing_page_domains")
      .select("id,hostname,kind")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row || row.kind !== "subdomain") throw new Error("Not found");

    const cf = await attachSubdomainToCloudflare(row.hostname).catch((e) => ({
      status: "error",
      error: (e as Error).message,
    }));
    await context.supabase
      .from("landing_page_domains")
      .update({
        status: cf.status,
        ssl_status: cf.status === "active" ? "issued" : "issuing",
        last_error: cf.error ?? null,
        last_checked_at: new Date().toISOString(),
        verified_at: cf.status === "active" ? new Date().toISOString() : null,
      } as never)
      .eq("id", row.id);
    return { status: cf.status, error: cf.error ?? null };
  });

/**
 * Custom domains the merchant already connected in Domain settings, with the
 * landing page each one is attached to (if any). Used by the search + connect
 * picker inside the landing builder.
 */
export const listAttachableDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_domains")
      .select("id,hostname,status,ssl_status,landing_page_id,last_error")
      .eq("store_id", store.id)
      .eq("kind", "custom")
      .order("hostname", { ascending: true });

    const rows = (data ?? []) as any[];
    const pageIds = [...new Set(rows.map((r) => r.landing_page_id).filter(Boolean))];
    const { data: pages } = pageIds.length
      ? await context.supabase.from("landing_pages").select("id,title,slug").in("id", pageIds)
      : { data: [] as any[] };
    const byId = new Map((pages ?? []).map((p: any) => [p.id, p]));
    return rows.map((r) => ({ ...r, landing_page: r.landing_page_id ? byId.get(r.landing_page_id) ?? null : null }));
  });

export const attachDomainToLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const page = await ownedPage(context.supabase, store.id, data.id);
    const { data: row } = await context.supabase
      .from("store_domains")
      .select("id,hostname,status,landing_page_id")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Domain not found");
    if (!["verified", "active"].includes(row.status)) {
      throw new Error("Verify this domain in Domain settings before connecting it");
    }
    if (row.landing_page_id && row.landing_page_id !== page.id) {
      throw new Error("This domain is already connected to another landing page");
    }
    const { error } = await context.supabase
      .from("store_domains")
      .update({ landing_page_id: page.id } as never)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    // A landing-page domain can never be the storefront's primary host.
    await context.supabase
      .from("stores")
      .update({ primary_domain_id: null })
      .eq("primary_domain_id", row.id);
    await context.supabase.from("store_domains").update({ is_primary: false } as never).eq("id", row.id);
    return { ok: true, hostname: row.hostname };
  });

export const detachDomainFromLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_domains")
      .update({ landing_page_id: null } as never)
      .eq("id", data.domainId)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/** Remove a landing subdomain (custom domains are managed in Domain settings). */
export const removeLandingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await requireMyStore(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("landing_page_domains")
      .select("id,hostname,kind")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (row.kind === "subdomain") {
      try {
        const { detachSubdomain } = await import("@/lib/cloudflare-pages.server");
        await detachSubdomain(row.hostname);
      } catch {
        /* keep going — the DB row must still be removed */
      }
    }
    const { error } = await context.supabase.from("landing_page_domains").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

