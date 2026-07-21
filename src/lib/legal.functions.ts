// Legal & Business Information Generator — server functions.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const infoSchema = z.object({
  store_name: z.string().trim().min(1).max(160),
  owner_name: z.string().trim().min(1).max(160),
  support_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().min(3).max(40),
  business_address: z.string().trim().min(3).max(500),
  website_domain: z.string().trim().min(3).max(200),
  country: z.string().trim().min(2).max(80),
  currency: z.string().trim().min(1).max(20),
});

async function getStoreForOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

export const getMyLegalInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getStoreForOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("store_legal_info")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    return { storeId, info: data };
  });

async function regenerateForStore(supabase: any, storeId: string) {
  const { data: row } = await supabase
    .from("store_legal_info")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!row) return null;
  const { generateAllPages } = await import("@/lib/legal-templates.server");
  const pages = generateAllPages({
    store_name: row.store_name,
    owner_name: row.owner_name,
    support_email: row.support_email,
    contact_phone: row.contact_phone,
    business_address: row.business_address,
    website_domain: row.website_domain,
    country: row.country,
    currency: row.currency,
  });
  const { error } = await supabase
    .from("store_legal_info")
    .update({
      pages,
      pages_version: (row.pages_version ?? 0) + 1,
      generated_at: new Date().toISOString(),
    })
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);
  return pages;
}

export const saveAndGenerateLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => infoSchema.parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await getStoreForOwner(context.supabase, context.userId);
    const { generateAllPages } = await import("@/lib/legal-templates.server");
    const pages = generateAllPages(data);
    const { error } = await context.supabase
      .from("store_legal_info")
      .upsert(
        {
          store_id: storeId,
          ...data,
          pages,
          pages_version: 1,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateLegalPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await getStoreForOwner(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("store_legal_info")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (!row) throw new Error("Generate all pages first");
    const { generatePage, LEGAL_PAGES } = await import("@/lib/legal-templates.server");
    const valid = LEGAL_PAGES.some((p) => p.key === data.key);
    if (!valid) throw new Error("Unknown page");
    const page = generatePage(data.key as any, {
      store_name: row.store_name,
      owner_name: row.owner_name,
      support_email: row.support_email,
      contact_phone: row.contact_phone,
      business_address: row.business_address,
      website_domain: row.website_domain,
      country: row.country,
      currency: row.currency,
    });
    const existing = (row.pages && typeof row.pages === "object" && !Array.isArray(row.pages)) ? (row.pages as Record<string, unknown>) : {};
    const pages = { ...existing, [data.key]: page };
    const { error } = await context.supabase
      .from("store_legal_info")
      .update({
        pages,
        pages_version: (row.pages_version ?? 0) + 1,
        generated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Called from other server functions (e.g. updateMyStore) to keep legal pages fresh.
export async function autoRegenerateLegalIfNeeded(supabase: any, storeId: string) {
  try {
    await regenerateForStore(supabase, storeId);
  } catch {
    // non-fatal
  }
}

// Public: resolve current host → slug → return the requested page.
export const getLegalPagePublic = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ page: z.string().min(1).max(40), slug: z.string().min(1).max(120).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient<Database>(process.env.SUPABASE_URL!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    let slug = data.slug;
    let origin = "";
    try {
      const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "";
      const proto = getRequestHeader("x-forwarded-proto") || "https";
      if (host) origin = `${proto}://${host}`.replace(/\/$/, "");
      if (!slug && host) {
        const { data: hostRow } = await sb.rpc("resolve_domain", { _host: host });
        if (hostRow && (hostRow as any).slug) slug = (hostRow as any).slug as string;
      }
    } catch {}

    if (!slug) return { origin, slug: null, store: null, page: null, info: null };

    const { data: row } = await sb.rpc("get_store_legal_page", { _slug: slug, _page: key });
    const j = (row ?? {}) as any;
    return {
      origin,
      slug,
      store: j.store ?? null,
      page: j.page ?? null,
      info: j.info ?? null,
    };
  });
