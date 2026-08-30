import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageIcon, Eye, EyeOff, Package } from "lucide-react";
import { getStoreTemplate, updateStoreTemplate } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { CategoryIconPicker } from "@/components/admin/CategoryIconPicker";
import { CategoryIconCluster } from "@/components/CategoryIconCluster";
import { getCategoryIcon } from "@/lib/category-icons";
import { ProductDialog } from "@/components/admin/product-form/ProductDialog";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/store-template")({
  component: StoreTemplatePage,
  head: () => ({
    meta: [
      { title: "Store Template — ORZEN Admin" },
      { name: "description", content: "Manage the default products, categories, and banners for new ORZEN stores." },
      { property: "og:title", content: "Store Template — ORZEN Admin" },
      { property: "og:description", content: "Manage the global default store template." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TEMPLATE_FOLDER = "_template";

export type TemplateCategory = {
  name: string;
  image_url?: string;
  icon_name?: string;
  icon_style?: "outline" | "colored";
  description?: string;
  parent_name?: string;
  sort_order?: number;
  is_active?: boolean;
};

type TemplateBanner = {
  title?: string;
  image_url: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
  product_type?: string;
  display_position?: string;
  category_name?: string;
};

const BANNER_TABS = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
] as const;

type BannerTabKey = (typeof BANNER_TABS)[number]["key"];

const BANNER_POSITIONS = [
  { value: "hero", label: "Hero Banner" },
  { value: "secondary", label: "Secondary Banner" },
  { value: "promotional", label: "Promotional Banner" },
  { value: "category", label: "Category Banner" },
] as const;

const BANNER_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type BannerSortKey = (typeof BANNER_SORTS)[number]["value"];

function bannerType(b: TemplateBanner): string {
  const t = (b.product_type ?? "").toString().trim().toLowerCase();
  if (!t || t === "both" || t === "general") return "physical";
  return t;
}


type TemplateProduct = {
  name: string;
  short_description?: string;
  description?: string;
  brand?: string;
  sku?: string;
  category_name?: string;
  subcategory_name?: string;
  image_url?: string;
  gallery?: string[];
  price?: number;
  old_price?: number;
  cost_price?: number;
  stock?: number;
  low_stock_alert?: number;
  status?: "active" | "draft";
  featured?: boolean;
  variants?: any;
  video_url?: string;
  product_type?: string;
  /** Full merchant-panel meta payload so editing round-trips exactly. */
  _meta?: Record<string, any>;
};

type TemplateForm = {
  description: string;
  all_category_image_url: string;
  banners: TemplateBanner[];
  categories: TemplateCategory[];
  products: TemplateProduct[];
};

const empty: TemplateForm = {
  description: "",
  all_category_image_url: "",
  banners: [],
  categories: [],
  products: [],
};

function imgSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function StoreTemplatePage() {
  const fetchTpl = useServerFn(getStoreTemplate);
  const saveTpl = useServerFn(updateStoreTemplate);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "store-template"], queryFn: () => fetchTpl() });

  // Keep the hook tree stable while the server data is loading. Starting this
  // as null previously returned before the useMemo hooks below, then rendered
  // those hooks after loading and crashed with "Rendered more hooks".
  const [form, setForm] = useState<TemplateForm>(empty);
  const [rest, setRest] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Products
  const [pq, setPq] = useState("");
  const [pOpen, setPOpen] = useState(false);
  const [pIndex, setPIndex] = useState<number | null>(null);

  // Categories
  const [cq, setCq] = useState("");
  const [cOpen, setCOpen] = useState(false);
  const [cIndex, setCIndex] = useState<number | null>(null);

  // Banners
  const [bq, setBq] = useState("");
  const [bOpen, setBOpen] = useState(false);
  const [bIndex, setBIndex] = useState<number | null>(null);
  const [bTab, setBTab] = useState<BannerTabKey>("all");
  const [bSort, setBSort] = useState<BannerSortKey>("newest");


  useEffect(() => {
    if (!data) return;
    const d = data as any;
    setRest({
      theme: d.theme ?? {},
      seo: d.seo ?? {},
      marketing: d.marketing ?? {},
      delivery: d.delivery ?? {},
      payments_config: d.payments_config ?? {},
      product_defaults: d.product_defaults ?? {},
      pages: d.pages ?? [],
    });
    setForm({
      ...empty,
      description: d.description ?? "",
      all_category_image_url: d.all_category_image_url ?? "",
      banners: (d.banners as TemplateBanner[]) ?? [],
      categories: (d.categories as TemplateCategory[]) ?? [],
      products: (d.products as TemplateProduct[]) ?? [],
    });
  }, [data]);

  const categoriesForDialog = useMemo(
    () =>
      (form?.categories ?? [])
        .filter((c) => c.name.trim())
        .map((c) => ({ id: c.name, name: c.name, parent_id: c.parent_name || null })),
    [form.categories],
  );

  function set<K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) {
    setForm((f) => ({ ...(f as TemplateForm), [k]: v }));
  }

  async function persist(next: TemplateForm) {
    setSaving(true);
    try {
      await saveTpl({ data: { ...rest, ...next } as any });
      qc.invalidateQueries({ queryKey: ["owner", "store-template"] });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ---------- products ----------
  const visibleProducts = useMemo(() => {
    const n = pq.trim().toLowerCase();
    return form.products
      .map((p, i) => ({ p, i }))
      .filter(({ p }) =>
        !n ? true : [p.name, p.sku, p.category_name].some((v) => (v ?? "").toLowerCase().includes(n)),
      );
  }, [form.products, pq]);

  function saveProduct(payload: any) {
    const meta = payload.meta ?? {};
    const next: TemplateProduct = {
      name: payload.name,
      short_description: payload.short_description ?? "",
      description: payload.description ?? "",
      brand: payload.brand ?? "",
      sku: payload.sku ?? "",
      category_name: payload.category_id ?? "",
      subcategory_name: meta.subcategory_id ?? "",
      image_url: payload.primary_image_url ?? "",
      gallery: payload.gallery ?? [],
      price: Number(payload.price ?? 0),
      old_price: payload.old_price != null ? Number(payload.old_price) : undefined,
      cost_price: payload.cost_price != null ? Number(payload.cost_price) : undefined,
      stock: Number(payload.stock ?? 0),
      low_stock_alert: payload.low_stock_threshold != null ? Number(payload.low_stock_threshold) : undefined,
      status: payload.status === "draft" ? "draft" : "active",
      featured: !!payload.is_featured,
      variants: payload.variants ?? null,
      video_url: payload.video_url ?? "",
      product_type: payload.product_type ?? "physical",
      _meta: meta,
    };
    const arr = [...form.products];
    if (pIndex == null) arr.push(next);
    else arr[pIndex] = next;
    const updated = { ...form, products: arr };
    setForm(updated);
    setPOpen(false);
    return persist(updated);
  }

  const editingProduct =
    pIndex == null
      ? null
      : (() => {
          const p = form.products[pIndex];
          return {
            id: `tpl-${pIndex}`,
            name: p.name,
            short_description: p.short_description ?? null,
            description: p.description ?? null,
            brand: p.brand ?? null,
            sku: p.sku ?? null,
            price: p.price ?? 0,
            old_price: p.old_price ?? null,
            cost_price: p.cost_price ?? 0,
            stock: p.stock ?? 0,
            low_stock_threshold: p.low_stock_alert ?? 5,
            status: p.status ?? "active",
            primary_image_url: p.image_url || null,
            gallery: p.gallery ?? [],
            is_featured: !!p.featured,
            category_id: p.category_name || null,
            variants: p.variants ?? null,
            video_url: p.video_url || null,
            product_type: p.product_type ?? "physical",
            meta: p._meta ?? {},
          } as any;
        })();

  // ---------- categories ----------
  const visibleCategories = useMemo(() => {
    const n = cq.trim().toLowerCase();
    return form.categories
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        !n ? true : (c.name + " " + (c.description ?? "")).toLowerCase().includes(n),
      );
  }, [form.categories, cq]);

  function saveCategory(next: TemplateCategory) {
    const arr = [...form.categories];
    if (cIndex == null) arr.push(next);
    else arr[cIndex] = next;
    const updated = { ...form, categories: arr };
    setForm(updated);
    setCOpen(false);
    return persist(updated);
  }

  // ---------- banners ----------
  const bannerActiveType = bTab === "all" ? "physical" : bTab;
  const bannerTypeCount = useMemo(
    () => form.banners.filter((b) => bannerType(b) === bannerActiveType).length,
    [form.banners, bannerActiveType],
  );
  const bannersFull = bTab !== "all" && bannerTypeCount >= 3;

  const visibleBanners = useMemo(() => {
    const n = bq.trim().toLowerCase();
    let rows = form.banners
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => {
        if (bTab !== "all" && bannerType(b) !== bTab) return false;
        if (!n) return true;
        return ((b.title ?? "") + " " + (b.link_url ?? "")).toLowerCase().includes(n);
      });
    if (bSort === "active") rows = rows.filter(({ b }) => b.is_active !== false);
    if (bSort === "inactive") rows = rows.filter(({ b }) => b.is_active === false);
    if (bSort === "oldest") rows = rows.slice().reverse();
    return rows;
  }, [form.banners, bq, bTab, bSort]);


  function saveBanner(next: TemplateBanner) {
    const arr = [...form.banners];
    if (bIndex == null) arr.push(next);
    else arr[bIndex] = next;
    const updated = { ...form, banners: arr };
    setForm(updated);
    setBOpen(false);
    return persist(updated);
  }

  const addProductBtn = (
    <Button
      onClick={() => {
        setPIndex(null);
        setPOpen(true);
      }}
    >
      <Plus className="mr-1 h-4 w-4" /> Add product
    </Button>
  );
  const addCategoryBtn = (
    <Button
      onClick={() => {
        setCIndex(null);
        setCOpen(true);
      }}
    >
      <Plus className="mr-1 h-4 w-4" /> Add category
    </Button>
  );
  const addBannerBtn = (
    <Button
      disabled={bannersFull}
      onClick={() => {
        setBIndex(null);
        setBOpen(true);
      }}
    >
      <Plus className="mr-1 h-4 w-4" /> Add banner
    </Button>
  );


  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Global Store Template"
        description="The blueprint every newly created store inherits. Same add/edit system as the Merchant Panel."
      />

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>

        {/* ============ Products ============ */}
        <TabsContent value="products" className="space-y-4">
          <AdminToolbar
            value={pq}
            onChange={setPq}
            placeholder="Search by name, SKU or category…"
            action={addProductBtn}
            trailing={<div className="hidden sm:block">{addProductBtn}</div>}
          />

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total", value: form.products.length },
              { label: "Active", value: form.products.filter((p) => (p.status ?? "active") === "active").length },
              { label: "Draft", value: form.products.filter((p) => p.status === "draft").length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {s.label}
                </div>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {visibleProducts.length === 0 ? (
              <div className="space-y-3 p-10 text-center">
                <p className="text-sm text-muted-foreground">No products yet.</p>
                {addProductBtn}
              </div>
            ) : (
              <ul className="divide-y">
                {visibleProducts.map(({ p, i }) => {
                  const src = imgSrc(p.image_url);
                  return (
                    <li key={i} className="flex items-center gap-3 p-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                        {src ? (
                          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="line-clamp-1 text-sm font-medium">{p.name || `Product ${i + 1}`}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px]",
                              (p.status ?? "active") === "active"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {(p.status ?? "active") === "active" ? "Active" : "Draft"}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {p.category_name ? `${p.category_name} · ` : ""}
                          {Number(p.price ?? 0)} · Stock {Number(p.stock ?? 0)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPIndex(i);
                          setPOpen(true);
                        }}
                        className="rounded p-2 hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Delete this product?")) return;
                          const updated = { ...form, products: form.products.filter((_, j) => j !== i) };
                          setForm(updated);
                          persist(updated);
                        }}
                        className="rounded p-2 text-destructive hover:bg-destructive/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ============ Categories ============ */}
        <TabsContent value="categories" className="space-y-4">
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <Label>"All" category image</Label>
            <p className="text-xs text-muted-foreground">
              Shown on the storefront as the first category tile. Square image recommended (512×512).
            </p>
            <ImageUploader
              folder={TEMPLATE_FOLDER}
              value={form.all_category_image_url || null}
              onChange={(v) => {
                const updated = { ...form, all_category_image_url: v ?? "" };
                setForm(updated);
                persist(updated);
              }}
            />
          </div>

          <AdminToolbar
            value={cq}
            onChange={setCq}
            placeholder="Search categories…"
            action={addCategoryBtn}
            trailing={<div className="hidden sm:block">{addCategoryBtn}</div>}
          />

          <div className="overflow-hidden rounded-xl border bg-card">
            {visibleCategories.length === 0 ? (
              <div className="space-y-3 p-10 text-center">
                <p className="text-sm text-muted-foreground">No categories found.</p>
                {addCategoryBtn}
              </div>
            ) : (
              <ul className="divide-y">
                {visibleCategories.map(({ c, i }) => {
                  const isSub = !!c.parent_name;
                  const src = imgSrc(c.image_url);
                  return (
                    <li key={i} className={cn("flex items-center gap-3 p-3", isSub && "pl-10")}>
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                        {!isSub && getCategoryIcon(c.icon_name) ? (
                          <CategoryIconCluster iconName={c.icon_name!} iconStyle={c.icon_style ?? "outline"} />
                        ) : !isSub && src ? (
                          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">
                          {isSub && <span className="text-muted-foreground">↳ </span>}
                          {c.name || `Category ${i + 1}`}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {isSub ? `In ${c.parent_name}` : "Main category"}
                          {c.description ? ` · ${c.description}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const arr = [...form.categories];
                          arr[i] = { ...c, is_active: c.is_active === false };
                          const updated = { ...form, categories: arr };
                          setForm(updated);
                          persist(updated);
                        }}
                        className="rounded p-2 hover:bg-muted"
                        aria-label={c.is_active === false ? "Show" : "Hide"}
                      >
                        {c.is_active === false ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setCIndex(i);
                          setCOpen(true);
                        }}
                        className="rounded p-2 hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Delete this category?")) return;
                          const updated = { ...form, categories: form.categories.filter((_, j) => j !== i) };
                          setForm(updated);
                          persist(updated);
                        }}
                        className="rounded p-2 text-destructive hover:bg-destructive/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ============ Banners ============ */}
        <TabsContent value="banners" className="space-y-4">
          <TypeFilterTabs tabs={BANNER_TABS} value={bTab} onChange={(k: string) => setBTab(k as BannerTabKey)} />

          <AdminToolbar
            value={bq}
            onChange={setBq}
            placeholder="Search banners…"
            action={addBannerBtn}
            trailing={
              <select
                value={bSort}
                onChange={(e) => setBSort(e.target.value as BannerSortKey)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-40"
                aria-label="Sort banners"
              >
                {BANNER_SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            }
          />

          {bannersFull && (
            <p className="text-xs text-muted-foreground">
              You have reached the limit of 3 banners for this product type.
            </p>
          )}

          {visibleBanners.length === 0 ? (
            <div className="space-y-3 rounded-xl border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">No banners found.</p>
              {addBannerBtn}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBanners.map(({ b, i }) => {
                const src = imgSrc(b.image_url);
                const isActive = b.is_active !== false;
                const pos =
                  BANNER_POSITIONS.find((p) => p.value === (b.display_position ?? "hero"))?.label ?? "Hero Banner";
                return (
                  <div key={i} className="overflow-hidden rounded-xl border bg-card">
                    <div className="grid aspect-[16/7] place-items-center bg-muted">
                      {src ? (
                        <img src={src} alt={b.title ?? ""} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-medium">{b.title || `Banner ${i + 1}`}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {pos}
                        </span>
                        {b.category_name && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {b.category_name}
                          </span>
                        )}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                          {bannerType(b)}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{b.link_url || "No link"}</p>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          Order {b.sort_order ?? i}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setBIndex(i);
                              setBOpen(true);
                            }}
                            className="rounded p-2 hover:bg-muted"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (!confirm("Delete banner?")) return;
                              const updated = { ...form, banners: form.banners.filter((_, j) => j !== i) };
                              setForm(updated);
                              persist(updated);
                            }}
                            className="rounded p-2 text-destructive hover:bg-destructive/10"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}

      {pOpen && (
        <ProductDialog
          storeId={TEMPLATE_FOLDER}
          editing={editingProduct}
          categories={categoriesForDialog}
          productDefaults={null}
          onClose={() => setPOpen(false)}
          onSave={async (payload: any) => {
            await saveProduct(payload);
          }}
        />
      )}

      {cOpen && (
        <TemplateCategoryDialog
          editing={cIndex == null ? null : form.categories[cIndex]}
          nextOrder={form.categories.length}
          allCategories={form.categories.filter((_, j) => j !== cIndex)}
          onClose={() => setCOpen(false)}
          onSave={async (c) => {
            await saveCategory(c);
          }}
        />
      )}

      {bOpen && (
        <TemplateBannerDialog
          editing={bIndex == null ? null : form.banners[bIndex]}
          nextOrder={form.banners.length}
          productType={bIndex == null ? bannerActiveType : bannerType(form.banners[bIndex])}
          categories={form.categories.filter((c) => c.name.trim()).map((c) => c.name)}
          onClose={() => setBOpen(false)}
          onSave={async (b) => {
            await saveBanner(b);
          }}
        />

      )}
    </div>
  );
}

function TemplateCategoryDialog({
  editing,
  nextOrder,
  allCategories,
  onClose,
  onSave,
}: {
  editing: TemplateCategory | null;
  nextOrder: number;
  allCategories: TemplateCategory[];
  onClose: () => void;
  onSave: (c: TemplateCategory) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [image, setImage] = useState<string | null>(editing?.image_url || null);
  const [iconName, setIconName] = useState<string | null>(editing?.icon_name || null);
  const [iconStyle, setIconStyle] = useState<"outline" | "colored">(
    editing?.icon_style === "colored" ? "colored" : "outline",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? nextOrder);
  const [isActive, setIsActive] = useState<boolean>(editing?.is_active !== false);
  const [parentName, setParentName] = useState<string>(editing?.parent_name ?? "");
  const [saving, setSaving] = useState(false);

  const parentOptions = allCategories.filter((c) => !c.parent_name && c.name.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const isSub = !!parentName;
      await onSave({
        name: name.trim(),
        image_url: isSub ? "" : image ?? "",
        icon_name: isSub ? "" : iconName ?? "",
        icon_style: isSub ? "outline" : iconStyle,
        description: description.trim(),
        parent_name: parentName,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-2rem)] max-w-[23rem] gap-2 overflow-x-hidden overflow-y-auto rounded-lg p-3 sm:max-h-[92vh] sm:max-w-lg sm:p-6">
        <DialogHeader className="min-w-0 pb-1 pr-6 text-left">
          <DialogTitle className="text-base sm:text-lg">{editing ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-3 sm:space-y-4">
          {!parentName && (
            <div className="space-y-1.5">
              <Label>Category icon</Label>
              <CategoryIconPicker
                folder={TEMPLATE_FOLDER}
                iconName={iconName}
                imageUrl={image}
                iconStyle={iconStyle}
                onChangeIcon={setIconName}
                onChangeImage={setImage}
                onChangeIconStyle={setIconStyle}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tn">Name</Label>
            <Input id="tn" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tp">Parent category</Label>
            <select
              id="tp"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— None (main category)</option>
              {parentOptions.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Leave empty to make this a main category. Selecting a parent makes this a text-only subcategory.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="td">Description</Label>
            <Textarea id="td" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tso">Display order</Label>
              <Input
                id="tso"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tst">Status</Label>
              <select
                id="tst"
                value={isActive ? "1" : "0"}
                onChange={(e) => setIsActive(e.target.value === "1")}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateBannerDialog({
  editing,
  nextOrder,
  productType,
  categories,
  onClose,
  onSave,
}: {
  editing: TemplateBanner | null;
  nextOrder: number;
  productType: string;
  categories: string[];
  onClose: () => void;
  onSave: (b: TemplateBanner) => Promise<void>;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [image, setImage] = useState<string | null>(editing?.image_url || null);
  const [link, setLink] = useState(editing?.link_url ?? "");
  const [position, setPosition] = useState<string>(editing?.display_position ?? "hero");
  const [categoryName, setCategoryName] = useState<string>(editing?.category_name ?? "");
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? nextOrder);
  const [isActive, setIsActive] = useState<boolean>(editing?.is_active !== false);
  const [saving, setSaving] = useState(false);

  const typeLabel = BANNER_TABS.find((t) => t.key === productType)?.label ?? "Physical";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    if (!image) return toast.error("Upload an image");
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        image_url: image,
        link_url: link.trim(),
        display_position: position,
        category_name: categoryName || undefined,
        product_type: productType,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">Product type: {typeLabel}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tbt">Banner title</Label>
            <Input id="tbt" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Banner image</Label>
            <ImageUploader folder={TEMPLATE_FOLDER} value={image} onChange={setImage} label="Upload banner" />
            <p className="text-xs text-muted-foreground">Recommended 1600×600 (JPG/PNG/WEBP).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tbl">Link (optional)</Label>
            <Input id="tbl" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/product/..." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tbp">Display position</Label>
            <select
              id="tbp"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {BANNER_POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tbc">Related category (optional)</Label>
            <select
              id="tbc"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— None</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>



          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tbo">Sort order</Label>
              <Input
                id="tbo"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tbs">Status</Label>
              <select
                id="tbs"
                value={isActive ? "1" : "0"}
                onChange={(e) => setIsActive(e.target.value === "1")}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
