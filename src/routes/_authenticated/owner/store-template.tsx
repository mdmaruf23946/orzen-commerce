import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStoreTemplate, updateStoreTemplate } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Trash2, Plus } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { CategoryIconPicker } from "@/components/admin/CategoryIconPicker";
import { CategoryIconCluster } from "@/components/CategoryIconCluster";

export const Route = createFileRoute("/_authenticated/owner/store-template")({
  component: StoreTemplatePage,
});

const TEMPLATE_FOLDER = "_template";

type Variant = { name: string; values: string[] };

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

type TemplateProduct = {
  name: string;
  slug?: string;
  short_description?: string;
  description?: string;
  sku?: string;
  brand?: string;
  category_name?: string;
  subcategory_name?: string;
  tags?: string[];
  image_url?: string;
  gallery?: string[];
  price?: number;
  sale_price?: number;
  cost_price?: number;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  stock?: number;
  low_stock_alert?: number;
  unlimited_stock?: boolean;
  status?: "active" | "draft";
  variants?: Variant[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  free_shipping?: boolean;
  youtube_url?: string;
  video_url?: string;
  meta_title?: string;
  meta_description?: string;
  seo_image?: string;
  featured?: boolean;
  new_arrival?: boolean;
  best_seller?: boolean;
  visibility?: "published" | "draft" | "hidden";
  is_active?: boolean;
};

type TemplateForm = {
  description: string;
  all_category_image_url: string;
  primary_color: string;
  header_color: string;
  title_bar_color: string;
  footer_color: string;
  button_color: string;
  theme: { radius?: number } & Record<string, any>;
  seo: Record<string, any>;
  marketing: Record<string, any>;
  delivery: Record<string, any>;
  payments_config: Record<string, any>;
  product_defaults: { warranty?: string; return_policy?: string; shipping_info?: string };
  banners: Array<{ image_url: string; link_url?: string; sort_order?: number }>;
  categories: TemplateCategory[];
  products: TemplateProduct[];
  pages: Array<{ slug: string; title: string; content: string }>;
};

const empty: TemplateForm = {
  description: "",
  all_category_image_url: "",
  primary_color: "#0f172a",
  header_color: "#ffffff",
  title_bar_color: "#0f172a",
  footer_color: "#0f172a",
  button_color: "#0f172a",
  theme: { radius: 8 },
  seo: {},
  marketing: {},
  delivery: {},
  payments_config: {},
  product_defaults: {},
  banners: [],
  categories: [],
  products: [],
  pages: [],
};

function StoreTemplatePage() {
  const fetchTpl = useServerFn(getStoreTemplate);
  const saveTpl = useServerFn(updateStoreTemplate);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "store-template"], queryFn: () => fetchTpl() });

  const [form, setForm] = useState<TemplateForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const d = data as any;
    setForm({
      ...empty,
      theme: { ...empty.theme, ...((d.theme as any) ?? {}) },
      seo: (d.seo as any) ?? {},
      marketing: (d.marketing as any) ?? {},
      delivery: (d.delivery as any) ?? {},
      payments_config: (d.payments_config as any) ?? {},
      product_defaults: (d.product_defaults as any) ?? {},
      banners: (d.banners as any) ?? [],
      categories: (d.categories as any) ?? [],
      products: (d.products as any) ?? [],
      pages: (d.pages as any) ?? [],
      description: d.description ?? "",
      all_category_image_url: d.all_category_image_url ?? "",
      primary_color: d.primary_color ?? "#0f172a",
      header_color: d.header_color ?? "#ffffff",
      title_bar_color: d.title_bar_color ?? "#0f172a",
      footer_color: d.footer_color ?? "#0f172a",
      button_color: d.button_color ?? "#0f172a",
    });
  }, [data]);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  function set<K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) {
    setForm((f) => ({ ...(f as TemplateForm), [k]: v }));
  }

  function updateProduct(i: number, patch: Partial<TemplateProduct>) {
    const arr = [...form!.products];
    arr[i] = { ...arr[i], ...patch };
    set("products", arr);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await saveTpl({ data: form as any });
      qc.invalidateQueries({ queryKey: ["owner", "store-template"] });
      toast.success("Template saved. New stores will use this from now on.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }




  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Global Store Template</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The blueprint every newly created store inherits. Existing stores keep their current setup unless their
          admin taps "Reset to Default Template".
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>



        {/* ============ Banners ============ */}
        <TabsContent value="banners" className="space-y-4 rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Upload banner images (JPG/PNG/WEBP, auto-compressed). Recommended 1600×600.
          </p>
          {form.banners.map((b, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">Banner {i + 1}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => set("banners", form.banners.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <ImageUploader
                folder={TEMPLATE_FOLDER}
                value={b.image_url || null}
                onChange={(v) => {
                  const arr = [...form.banners];
                  arr[i] = { ...b, image_url: v ?? "" };
                  set("banners", arr);
                }}
                label="Upload banner"
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <Label>Link (optional)</Label>
                  <Input
                    placeholder="/product/..."
                    value={b.link_url ?? ""}
                    onChange={(e) => {
                      const arr = [...form.banners];
                      arr[i] = { ...b, link_url: e.target.value };
                      set("banners", arr);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={b.sort_order ?? i}
                    onChange={(e) => {
                      const arr = [...form.banners];
                      arr[i] = { ...b, sort_order: Number(e.target.value) };
                      set("banners", arr);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => set("banners", [...form.banners, { image_url: "", link_url: "", sort_order: form.banners.length }])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add banner
          </Button>
        </TabsContent>

        {/* ============ Categories ============ */}
        <TabsContent value="categories" className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label>"All" category image</Label>
            <p className="text-xs text-muted-foreground">
              Shown on the storefront "All" tile. New stores inherit this image.
            </p>
            <ImageUploader
              folder={TEMPLATE_FOLDER}
              value={form.all_category_image_url || null}
              onChange={(v) => set("all_category_image_url", v ?? "")}
              label="Upload image"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Same system as the Merchant Panel: main categories support 1–3 preset icons (outline or colored) or a
            custom square image; subcategories are text-only.
          </p>

          {form.categories.map((c, i) => {
            const isSub = !!c.parent_name;
            const patch = (v: Partial<TemplateCategory>) => {
              const arr = [...form.categories];
              arr[i] = { ...c, ...v };
              set("categories", arr);
            };
            return (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
                      {!isSub && c.icon_name ? (
                        <CategoryIconCluster iconName={c.icon_name} iconStyle={c.icon_style ?? "outline"} />
                      ) : !isSub && c.image_url ? (
                        <img
                          src={c.image_url.startsWith("http") ? c.image_url : `/api/img/${c.image_url}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">{isSub ? "Sub" : "—"}</span>
                      )}
                    </span>
                    <div className="min-w-0 text-sm font-medium">
                      {c.name || `Category ${i + 1}`}
                      {isSub && (
                        <span className="ml-1 text-xs text-muted-foreground">↳ in {c.parent_name}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => set("categories", form.categories.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {!isSub && (
                  <div className="space-y-1.5">
                    <Label>Category icon</Label>
                    <CategoryIconPicker
                      folder={TEMPLATE_FOLDER}
                      iconName={c.icon_name ?? null}
                      imageUrl={c.image_url || null}
                      iconStyle={c.icon_style === "colored" ? "colored" : "outline"}
                      onChangeIcon={(v) => patch({ icon_name: v ?? "" })}
                      onChangeImage={(v) => patch({ image_url: v ?? "" })}
                      onChangeIconStyle={(v) => patch({ icon_style: v })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={c.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Parent category</Label>
                  <select
                    value={c.parent_name ?? ""}
                    onChange={(e) => {
                      const parent = e.target.value || "";
                      patch(
                        parent
                          ? { parent_name: parent, icon_name: "", image_url: "", icon_style: "outline" }
                          : { parent_name: "" },
                      );
                    }}
                    className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">— None (main category)</option>
                    {form.categories
                      .filter((p, j) => j !== i && !p.parent_name && p.name.trim())
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty for a main category. Selecting a parent makes this a text-only subcategory.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea
                    rows={2}
                    value={c.description ?? ""}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Display order</Label>
                    <Input
                      type="number"
                      min={0}
                      value={c.sort_order ?? i}
                      onChange={(e) => patch({ sort_order: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <select
                      value={c.is_active === false ? "0" : "1"}
                      onChange={(e) => patch({ is_active: e.target.value === "1" })}
                      className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set("categories", [
                ...form.categories,
                {
                  name: "",
                  image_url: "",
                  icon_name: "",
                  icon_style: "outline",
                  description: "",
                  parent_name: "",
                  sort_order: form.categories.length,
                  is_active: true,
                },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add category
          </Button>
        </TabsContent>


        {/* ============ Products ============ */}
        <TabsContent value="products" className="space-y-4 rounded-xl border bg-card p-4">
          <Accordion type="multiple" className="space-y-2">
            {form.products.map((p, i) => (
              <AccordionItem key={i} value={`p-${i}`} className="rounded-lg border">
                <AccordionTrigger className="px-3 py-2 text-left">
                  <span className="truncate">{p.name || `Product ${i + 1}`}</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 px-3 pb-3">
                  <ProductEditor
                    product={p}
                    onChange={(patch) => updateProduct(i, patch)}
                    onRemove={() => set("products", form.products.filter((_, j) => j !== i))}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set("products", [
                ...form.products,
                { name: "", price: 0, stock: 0, status: "active", gallery: [], variants: [] },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Button>
        </TabsContent>

      </Tabs>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ProductEditor
// ============================================================
function ProductEditor({
  product,
  onChange,
  onRemove,
}: {
  product: TemplateProduct;
  onChange: (patch: Partial<TemplateProduct>) => void;
  onRemove: () => void;
}) {
  const p = product;
  const tagsStr = (p.tags ?? []).join(", ");
  const setTags = (s: string) =>
    onChange({ tags: s.split(",").map((t) => t.trim()).filter(Boolean) });

  const addVariant = () =>
    onChange({ variants: [...(p.variants ?? []), { name: "", values: [] }] });

  const updateVariant = (idx: number, patch: Partial<Variant>) => {
    const arr = [...(p.variants ?? [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange({ variants: arr });
  };

  return (
    <Tabs defaultValue="basic">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="variants">Variants</TabsTrigger>
        <TabsTrigger value="shipping">Shipping</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
        <TabsTrigger value="visibility">Visibility</TabsTrigger>
      </TabsList>

      {/* Basic */}
      <TabsContent value="basic" className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Product name">
            <Input value={p.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label="Slug">
            <Input
              value={p.slug ?? ""}
              placeholder="auto"
              onChange={(e) => onChange({ slug: e.target.value })}
            />
          </Field>
          <Field label="SKU / Code">
            <Input value={p.sku ?? ""} onChange={(e) => onChange({ sku: e.target.value })} />
          </Field>
          <Field label="Brand">
            <Input value={p.brand ?? ""} onChange={(e) => onChange({ brand: e.target.value })} />
          </Field>
          <Field label="Category (must match a template category name)">
            <Input
              value={p.category_name ?? ""}
              onChange={(e) => onChange({ category_name: e.target.value })}
            />
          </Field>
          <Field label="Subcategory (optional)">
            <Input
              value={p.subcategory_name ?? ""}
              onChange={(e) => onChange({ subcategory_name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Tags (comma-separated)">
          <Input value={tagsStr} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label="Short description">
          <Textarea
            rows={2}
            value={p.short_description ?? ""}
            onChange={(e) => onChange({ short_description: e.target.value })}
          />
        </Field>
        <Field label="Full description">
          <Textarea
            rows={4}
            value={p.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="mr-2 h-4 w-4" /> Remove product
        </Button>
      </TabsContent>

      {/* Images */}
      <TabsContent value="images" className="space-y-4 pt-3">
        <Field label="Main product image">
          <ImageUploader
            folder={TEMPLATE_FOLDER}
            value={p.image_url || null}
            onChange={(v) => onChange({ image_url: v ?? "" })}
            label="Upload"
          />
        </Field>
        <Field label="Gallery (drag to reorder)">
          <GalleryUploader
            folder={TEMPLATE_FOLDER}
            value={p.gallery ?? []}
            onChange={(v) => onChange({ gallery: v })}
          />
        </Field>
      </TabsContent>

      {/* Pricing */}
      <TabsContent value="pricing" className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Regular price">
            <Input
              type="number"
              value={p.price ?? ""}
              onChange={(e) => onChange({ price: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Sale price">
            <Input
              type="number"
              value={p.sale_price ?? ""}
              onChange={(e) => onChange({ sale_price: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Cost price">
            <Input
              type="number"
              value={p.cost_price ?? ""}
              onChange={(e) => onChange({ cost_price: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Discount type">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={p.discount_type ?? ""}
              onChange={(e) => onChange({ discount_type: (e.target.value || undefined) as any })}
            >
              <option value="">None</option>
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed</option>
            </select>
          </Field>
          <Field label="Discount value">
            <Input
              type="number"
              value={p.discount_value ?? ""}
              onChange={(e) =>
                onChange({ discount_value: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </TabsContent>

      {/* Inventory */}
      <TabsContent value="inventory" className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Stock quantity">
            <Input
              type="number"
              value={p.stock ?? ""}
              disabled={!!p.unlimited_stock}
              onChange={(e) => onChange({ stock: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Low-stock alert">
            <Input
              type="number"
              value={p.low_stock_alert ?? ""}
              onChange={(e) =>
                onChange({ low_stock_alert: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!p.unlimited_stock}
            onChange={(e) => onChange({ unlimited_stock: e.target.checked })}
          />
          Unlimited stock
        </label>
        <Field label="Product status">
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={p.status ?? "active"}
            onChange={(e) => onChange({ status: e.target.value as any })}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
      </TabsContent>

      {/* Variants */}
      <TabsContent value="variants" className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">
          Add attributes like Size, Color, Model, Storage, RAM, or any custom attribute.
        </p>
        {(p.variants ?? []).map((v, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              placeholder="Attribute (Size)"
              value={v.name}
              onChange={(e) => updateVariant(i, { name: e.target.value })}
            />
            <Input
              placeholder="Values, comma-separated (S, M, L)"
              value={(v.values ?? []).join(", ")}
              onChange={(e) =>
                updateVariant(i, {
                  values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange({ variants: (p.variants ?? []).filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addVariant}>
          <Plus className="mr-2 h-4 w-4" /> Add attribute
        </Button>
      </TabsContent>

      {/* Shipping */}
      <TabsContent value="shipping" className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Weight (g)">
            <Input
              type="number"
              value={p.weight ?? ""}
              onChange={(e) => onChange({ weight: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Length (cm)">
            <Input
              type="number"
              value={p.length ?? ""}
              onChange={(e) => onChange({ length: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Width (cm)">
            <Input
              type="number"
              value={p.width ?? ""}
              onChange={(e) => onChange({ width: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Height (cm)">
            <Input
              type="number"
              value={p.height ?? ""}
              onChange={(e) => onChange({ height: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!p.free_shipping}
            onChange={(e) => onChange({ free_shipping: e.target.checked })}
          />
          Free shipping
        </label>
      </TabsContent>

      {/* Media */}
      <TabsContent value="media" className="space-y-3 pt-3">
        <Field label="YouTube video URL">
          <Input
            value={p.youtube_url ?? ""}
            placeholder="https://youtube.com/watch?v=..."
            onChange={(e) => onChange({ youtube_url: e.target.value })}
          />
        </Field>
        <Field label="Product video (optional, mp4 up to 25 MB)">
          <ImageUploader
            folder={TEMPLATE_FOLDER}
            value={p.video_url || null}
            onChange={(v) => onChange({ video_url: v ?? "" })}
            accept="video/mp4,video/webm"
            maxBytes={25 * 1024 * 1024}
            label="Upload video"
          />
        </Field>
      </TabsContent>

      {/* SEO */}
      <TabsContent value="seo" className="space-y-3 pt-3">
        <Field label="Meta title">
          <Input value={p.meta_title ?? ""} onChange={(e) => onChange({ meta_title: e.target.value })} />
        </Field>
        <Field label="Meta description">
          <Textarea
            rows={2}
            value={p.meta_description ?? ""}
            onChange={(e) => onChange({ meta_description: e.target.value })}
          />
        </Field>
        <Field label="SEO image (1200×630)">
          <ImageUploader
            folder={TEMPLATE_FOLDER}
            value={p.seo_image || null}
            onChange={(v) => onChange({ seo_image: v ?? "" })}
            label="Upload"
          />
        </Field>
      </TabsContent>

      {/* Visibility */}
      <TabsContent value="visibility" className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.featured}
              onChange={(e) => onChange({ featured: e.target.checked })}
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.new_arrival}
              onChange={(e) => onChange({ new_arrival: e.target.checked })}
            />
            New arrival
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.best_seller}
              onChange={(e) => onChange({ best_seller: e.target.checked })}
            />
            Best seller
          </label>
        </div>
        <Field label="Visibility">
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={p.visibility ?? "published"}
            onChange={(e) => onChange({ visibility: e.target.value as any })}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
        </Field>
      </TabsContent>
    </Tabs>
  );
}




function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
