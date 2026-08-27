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
  // Use the SECURITY DEFINER RPC which strips sensitive fields (marketing pixels,
  // payment config). RLS on store_template restricts direct SELECT to owners only.
  const { data, error } = await supabase.rpc("get_store_template_for_seed");
  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * Copy template scalar/jsonb fields onto a store. Does NOT touch child rows.
 * Returns the fields object so caller can decide UPDATE vs merge-on-INSERT.
 */
export function templateStoreFields(tpl: any) {
  if (!tpl) return {};
  return {
    description: tpl.description ?? null,
    all_category_image_url: tpl.all_category_image_url ?? null,
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
    const clean = catList.filter((c) => typeof c?.name === "string" && c.name.trim());
    const toRow = (c: any, i: number, parentId: string | null) => ({
      store_id: storeId,
      name: String(c.name).trim(),
      parent_id: parentId,
      image_url: parentId ? null : c.image_url || null,
      icon_name: parentId ? null : c.icon_name || null,
      icon_style: parentId ? "outline" : c.icon_style === "colored" ? "colored" : "outline",
      description: c.description || null,
      sort_order: Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : i,
      is_active: c.is_active === false ? false : true,
    });

    const mains = clean.filter((c) => !c.parent_name);
    if (mains.length) {
      const { data: created, error } = await supabase
        .from("categories")
        .insert(mains.map((c, i) => toRow(c, i, null)))
        .select("id,name");
      if (error) throw new Error(error.message);
      for (const c of created ?? []) catNameToId.set(c.name, c.id);
    }

    const subs = clean
      .filter((c) => c.parent_name && catNameToId.has(String(c.parent_name).trim()))
      .map((c, i) => toRow(c, i, catNameToId.get(String(c.parent_name).trim())!));
    if (subs.length) {
      const { data: created, error } = await supabase.from("categories").insert(subs).select("id,name");
      if (error) throw new Error(error.message);
      for (const c of created ?? []) if (!catNameToId.has(c.name)) catNameToId.set(c.name, c.id);
    }
  }

  const prodList: any[] = Array.isArray(tpl.products) ? tpl.products : [];
  if (prodList.length) {
    const rows = prodList
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .map((p) => {
        const gallery = Array.isArray(p.images) ? p.images : Array.isArray(p.gallery) ? p.gallery : [];
        const price = Number(p.price ?? 0);
        const salePrice = p.sale_price != null ? Number(p.sale_price) : null;
        // Anything without a dedicated column gets stashed on `meta`.
        const meta: Record<string, unknown> = {};
        if (p.short_description) meta.short_description = p.short_description;
        if (p.brand) meta.brand = p.brand;
        if (p.subcategory_name) meta.subcategory_name = p.subcategory_name;
        if (Array.isArray(p.tags)) meta.tags = p.tags;
        if (p.discount_type) meta.discount_type = p.discount_type;
        if (p.discount_value != null) meta.discount_value = Number(p.discount_value);
        if (p.unlimited_stock) meta.unlimited_stock = true;
        if (Array.isArray(p.variants)) meta.variants = p.variants;
        if (p.weight != null) meta.weight = Number(p.weight);
        if (p.length != null) meta.length = Number(p.length);
        if (p.width != null) meta.width = Number(p.width);
        if (p.height != null) meta.height = Number(p.height);
        if (p.free_shipping) meta.free_shipping = true;
        if (p.youtube_url) meta.youtube_url = p.youtube_url;
        if (p.video_url) meta.video_url = p.video_url;
        if (p.meta_title) meta.meta_title = p.meta_title;
        if (p.meta_description) meta.meta_description = p.meta_description;
        if (p.seo_image) meta.seo_image = p.seo_image;
        if (p.new_arrival) meta.new_arrival = true;
        if (p.best_seller) meta.best_seller = true;
        if (p.visibility) meta.visibility = p.visibility;

        return {
          store_id: storeId,
          name: String(p.name).trim(),
          slug: (p.slug ? slugify(String(p.slug)) : slugify(String(p.name))) + "-" + Math.random().toString(36).slice(2, 6),
          description: p.description ?? null,
          price,
          old_price: p.old_price != null ? Number(p.old_price) : salePrice != null && salePrice < price ? price : null,
          cost_price: p.cost_price != null ? Number(p.cost_price) : null,
          stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
          low_stock_threshold: p.low_stock_alert != null ? Number(p.low_stock_alert) : null,
          sku: p.sku ?? null,
          status: (p.status === "draft" || p.is_active === false ? "draft" : "active") as "active" | "draft",
          primary_image_url: p.image_url ?? p.primary_image_url ?? null,
          gallery,
          is_featured: p.featured === true,
          category_id: p.category_name ? catNameToId.get(String(p.category_name).trim()) ?? null : null,
          meta,
        };
      });
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
