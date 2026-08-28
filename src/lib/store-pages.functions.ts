// Merchant-editable storefront pages (About, Policies, Blogs, ...) — server functions.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";
import { STORE_PAGE_KEYS } from "@/lib/store-pages";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function requestOrigin(): string {
  try {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    /* no request context */
  }
  return "";
}

const pageKey = z.string().refine((v) => STORE_PAGE_KEYS.includes(v), "Unknown page");

/** Public: read one published page for a storefront. */
export const getStorePagePublic = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1).max(120), pageKey }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row } = await sb.rpc("get_store_page", {
      _slug: data.slug,
      _page_key: data.pageKey,
    });
    const j = (row ?? {}) as any;
    return {
      origin: requestOrigin(),
      slug: data.slug,
      store: j.store ?? null,
      page: j.page ?? null,
    };
  });

/** Public: which pages are published (used to hide empty footer links). */
export const listStorePagesPublic = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows } = await sb.rpc("list_store_pages_public", { _slug: data.slug });
    return (rows ?? []) as Array<{ page_key: string; title: string }>;
  });

async function storeIdFor(supabase: any, userId: string) {
  const row = await myStoreRow(supabase, userId, "id, slug, name", "pages");
  if (!row) throw new Error("Store not found");
  return row as { id: string; slug: string; name: string };
}

/** Merchant: list every saved page for the current store. */
export const listMyStorePages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await storeIdFor(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_pages")
      .select("id, page_key, title, content_html, seo_description, is_published, updated_at")
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    return { store, pages: data ?? [] };
  });

const saveSchema = z.object({
  pageKey,
  title: z.string().trim().max(160),
  content_html: z.string().max(200_000),
  seo_description: z.string().trim().max(300).optional().nullable(),
  is_published: z.boolean(),
});

/** Merchant: create or update a page. HTML is sanitized server-side. */
export const saveMyStorePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const store = await storeIdFor(context.supabase, context.userId);
    const { sanitizePageHtml } = await import("@/lib/store-pages.server");
    const html = sanitizePageHtml(data.content_html);
    const { error } = await context.supabase.from("store_pages").upsert(
      {
        store_id: store.id,
        page_key: data.pageKey,
        title: data.title,
        content_html: html,
        seo_description: data.seo_description || null,
        is_published: data.is_published,
      },
      { onConflict: "store_id,page_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Merchant: fill a policy page with generated starter content. */
export const generateStarterPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pageKey }).parse(d))
  .handler(async ({ context, data }) => {
    const store = await storeIdFor(context.supabase, context.userId);
    const { starterContent } = await import("@/lib/store-pages.server");
    const { data: info } = await context.supabase
      .from("store_legal_info")
      .select("*")
      .eq("store_id", store.id)
      .maybeSingle();
    const { data: storeRow } = await context.supabase
      .from("stores")
      .select("name, email, phone, address")
      .eq("id", store.id)
      .maybeSingle();
    return starterContent(data.pageKey, {
      store_name: info?.store_name || storeRow?.name || store.name,
      owner_name: info?.owner_name || storeRow?.name || store.name,
      support_email: info?.support_email || storeRow?.email || "",
      contact_phone: info?.contact_phone || storeRow?.phone || "",
      business_address: info?.business_address || storeRow?.address || "",
      website_domain: info?.website_domain || `${store.slug}.orzen.top`,
      country: info?.country || "Bangladesh",
      currency: info?.currency || "BDT",
    });
  });
