// Shared helpers to apply the global store template to a store.
// No server-only imports here so this module is safe to bundle anywhere;
// it only executes when called from a server function with a supabase client.

type SB = any;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function fetchTemplate(supabase: SB) {
  const { data, error } = await supabase.from("store_template").select("*").eq("id", "global").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Copy template scalar/jsonb fields onto a store. Does NOT touch child rows.
 * Returns the fields object so caller can decide UPDATE vs merge-on-INSERT.
 */
export function templateStoreFields(tpl: any) {
  if (!tpl) return {};
  return {
    description: tpl.description ?? null,
    primary_color: tpl.primary_color ?? "#0f172a",
    header_color: tpl.header_color ?? null,
    title_bar_color: tpl.title_bar_color ?? null,
    footer_color: tpl.footer_color ?? null,
    button_color: tpl.button_color ?? null,
    theme: tpl.theme ?? {},
    seo: tpl.seo ?? {},
    marketing: tpl.marketing ?? {},
    delivery: tpl.delivery ?? {},
    payments_config: tpl.payments_config ?? {},
    product_defaults: tpl.product_defaults ?? {},
    template_version: tpl.updated_at,
  };
}

/**
 * Seed categories, products and banners on a store from a template snapshot.
 * Idempotent per-call: caller is responsible for wiping first if needed.
 */
export async function seedStoreFromTemplate(supabase: SB, storeId: string, tpl: any) {
  if (!tpl) return;

  const catList: any[] = Array.isArray(tpl.categories) ? tpl.categories : [];
  const catNameToId = new Map<string, string>();
  if (catList.length) {
    const rows = catList
      .filter((c) => typeof c?.name === "string" && c.name.trim())
      .map((c) => ({ store_id: storeId, name: String(c.name).trim() }));
    if (rows.length) {
      const { data: created, error } = await supabase.from("categories").insert(rows).select("id,name");
      if (error) throw new Error(error.message);
      for (const c of created ?? []) catNameToId.set(c.name, c.id);
    }
  }

  const prodList: any[] = Array.isArray(tpl.products) ? tpl.products : [];
  if (prodList.length) {
    const rows = prodList
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .map((p) => ({
        store_id: storeId,
        name: String(p.name).trim(),
        slug: slugify(String(p.name)) + "-" + Math.random().toString(36).slice(2, 6),
        description: p.description ?? null,
        price: Number(p.price ?? 0),
        old_price: p.old_price != null ? Number(p.old_price) : null,
        stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
        sku: p.sku ?? null,
        status: (p.is_active === false ? "draft" : "active") as "active" | "draft",
        primary_image_url: p.image_url ?? p.primary_image_url ?? null,
        gallery: Array.isArray(p.images) ? p.images : Array.isArray(p.gallery) ? p.gallery : [],
        category_id: p.category_name ? catNameToId.get(String(p.category_name).trim()) ?? null : null,
      }));
    if (rows.length) {
      const { error } = await supabase.from("products").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  const bannerList: any[] = Array.isArray(tpl.banners) ? tpl.banners : [];
  if (bannerList.length) {
    const rows = bannerList
      .filter((b) => typeof b?.image_url === "string" && b.image_url)
      .map((b, i) => ({
        store_id: storeId,
        image_url: String(b.image_url),
        link: b.link_url ?? b.link ?? null,
        position: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : i,
      }));
    if (rows.length) {
      const { error } = await supabase.from("banners").insert(rows);
      if (error) throw new Error(error.message);
    }
  }
}

/**
 * Wipe store child rows (categories, products, banners) so a fresh template
 * seed can be applied on top.
 */
export async function wipeStoreChildren(supabase: SB, storeId: string) {
  await supabase.from("products").delete().eq("store_id", storeId);
  await supabase.from("categories").delete().eq("store_id", storeId);
  await supabase.from("banners").delete().eq("store_id", storeId);
}
