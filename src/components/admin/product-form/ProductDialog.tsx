import { lazy, Suspense, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Trash2, Crop, Plus, X, Youtube, Facebook } from "lucide-react";
import {
  upsertCategory,
  listMyProducts,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { DigitalFilesUploader, type DigitalFile } from "./DigitalFilesUploader";


const RichTextEditor = lazy(() => import("./RichTextEditor"));
const CropDialog = lazy(() => import("./CropDialog"));

type Product = Awaited<ReturnType<typeof listMyProducts>>[number];
type Category = { id: string; name: string; parent_id?: string | null };

// ---- meta helpers ------------------------------------------------------
type ProductMeta = {
  product_type?: "physical" | "digital" | "service" | "subscription";
  subcategory_id?: string | null;
  discount?: { type: "percent" | "fixed"; value: number } | null;
  tax?: { rate: number; inclusive: boolean } | null;
  barcode?: string | null;
  inventory_status?: "in_stock" | "out_of_stock" | "pre_order";
  stock_managed?: boolean;
  shipping?: { weight?: number; l?: number; w?: number; h?: number; type?: "free" | "fixed" | "calculated"; rate?: number };
  purchase?: { cod?: boolean; online?: boolean; min_qty?: number; max_qty?: number };
  labels?: string[];
  related?: { related?: string[]; fbt?: string[]; cross?: string[]; upsell?: string[] };
  seo?: { title?: string; description?: string; keywords?: string; slug?: string };
  videos?: { url: string; provider: "youtube" | "facebook"; primary?: boolean }[];
  visibility?: { scheduled_at?: string | null };
  ai_ready?: { description?: boolean; enhance?: boolean; bg_removal?: boolean; seo?: boolean };
  digital?: DigitalMeta;
};

type DigitalMeta = {
  files?: DigitalFile[];
  external_url?: string | null;
  version?: string | null;
  changelog?: string | null;
  platforms?: string[];
  tags?: string[];
  preview?: { images?: string[]; video_url?: string | null; demo_url?: string | null };
  download?: {
    mode?: "instant" | "manual";
    max_downloads?: number | null;
    expiry_days?: number | null;
    allow_redownload?: boolean;
  };
  free?: boolean;
  sale_window?: { start?: string | null; end?: string | null };
};


type VariantsV2 = {
  options: { name: string; values: string[] }[];
  items: {
    id: string;
    options: Record<string, string>;
    sku?: string | null;
    price?: number | null;
    discount?: number | null;
    stock?: number | null;
    barcode?: string | null;
    image?: string | null;
  }[];
};

function normalizeVariants(raw: any): VariantsV2 {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "options" in raw && "items" in raw) {
    return raw as VariantsV2;
  }
  if (Array.isArray(raw) && raw.length) {
    const items = raw.map((v: any, i: number) => ({
      id: String(i),
      options: { Variant: String(v?.name ?? `V${i + 1}`) },
      sku: v?.sku ?? null,
      price: v?.price ?? null,
      stock: v?.stock ?? null,
      discount: null,
      barcode: null,
      image: null,
    }));
    const values = items.map((i) => i.options.Variant);
    return { options: [{ name: "Variant", values }], items };
  }
  return { options: [], items: [] };
}

function buildMatrix(options: VariantsV2["options"], existing: VariantsV2["items"]): VariantsV2["items"] {
  if (!options.length || options.some((o) => !o.values.length)) return [];
  const combos: Record<string, string>[] = [{}];
  for (const opt of options) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const val of opt.values) next.push({ ...combo, [opt.name]: val });
    }
    combos.splice(0, combos.length, ...next);
  }
  return combos.map((options, idx) => {
    const id = Object.values(options).join("::");
    const prior = existing.find((e) => e.id === id);
    return prior ?? { id, options, sku: null, price: null, discount: null, stock: 0, barcode: null, image: null };
  });
}

function generateSku(name: string) {
  const base = (name || "SKU").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SKU";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${rand}`;
}

function parseVideoUrl(url: string): "youtube" | "facebook" | null {
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  return null;
}

function toEmbed(url: string, provider: "youtube" | "facebook"): string {
  if (provider === "youtube") {
    const m = url.match(/(?:v=|be\/|shorts\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}

const LABEL_OPTIONS = ["Featured", "Best Seller", "New Arrival", "Hot", "Sale", "Limited Stock"] as const;
const PLATFORM_OPTIONS = ["Windows", "macOS", "Linux", "Android", "iOS", "Web"] as const;


// -----------------------------------------------------------------------

export function ProductDialog({
  storeId,
  editing,
  categories,
  productDefaults,
  onClose,
  onSave,
}: {
  storeId: string;
  editing: Product | null;
  categories: Category[];
  productDefaults: { warranty?: string; return_policy?: string; shipping_info?: string } | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const qc = useQueryClient();
  const createCat = useServerFn(upsertCategory);
  const listProductsFn = useServerFn(listMyProducts);
  const meta0 = ((editing as any)?.meta ?? {}) as ProductMeta;

  // ---- state ----
  const [name, setName] = useState(editing?.name ?? "");
  const [shortDesc, setShortDesc] = useState<string>((editing as any)?.short_description ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [brand, setBrand] = useState<string>((editing as any)?.brand ?? "");
  const [productCode, setProductCode] = useState<string>((editing as any)?.product_code ?? "");
  const [productType, setProductType] = useState<ProductMeta["product_type"]>(meta0.product_type ?? "physical");
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string>(meta0.subcategory_id ?? "");

  const [regularPrice, setRegularPrice] = useState<string>(
    editing?.old_price != null ? String(editing.old_price) : editing ? String(editing.price) : "",
  );
  const [salePrice, setSalePrice] = useState<string>(editing?.old_price != null ? String(editing.price) : "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(meta0.discount?.type ?? "percent");
  const [costPrice, setCostPrice] = useState<string>((editing as any)?.cost_price != null ? String((editing as any).cost_price) : "");
  const [taxRate, setTaxRate] = useState<string>(meta0.tax?.rate != null ? String(meta0.tax.rate) : "");
  const [taxInclusive, setTaxInclusive] = useState<boolean>(meta0.tax?.inclusive ?? false);

  const [stockManaged, setStockManaged] = useState<boolean>(meta0.stock_managed ?? true);
  const [stock, setStock] = useState<number>(editing?.stock ?? 0);
  const [lowThreshold, setLowThreshold] = useState<number>((editing as any)?.low_stock_threshold ?? 5);
  const [inventoryStatus, setInventoryStatus] = useState<NonNullable<ProductMeta["inventory_status"]>>(
    meta0.inventory_status ?? "in_stock",
  );
  const [barcode, setBarcode] = useState<string>(meta0.barcode ?? "");
  const [sku, setSku] = useState<string>((editing as any)?.sku ?? "");

  const [image, setImage] = useState<string | null>(editing?.primary_image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(Array.isArray(editing?.gallery) ? (editing!.gallery as string[]) : []);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const [videos, setVideos] = useState<NonNullable<ProductMeta["videos"]>>(
    meta0.videos ?? (editing?.video_url ? [{ url: editing.video_url, provider: parseVideoUrl(editing.video_url) ?? "youtube", primary: true }] : []),
  );
  const [videoInput, setVideoInput] = useState("");

  const [variants, setVariants] = useState<VariantsV2>(normalizeVariants(editing?.variants));

  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(
    Array.isArray((editing as any)?.specifications) ? ((editing as any).specifications as any) : [],
  );

  const [shipping, setShipping] = useState<NonNullable<ProductMeta["shipping"]>>(meta0.shipping ?? { type: "free" });
  const [purchase, setPurchase] = useState<NonNullable<ProductMeta["purchase"]>>(
    meta0.purchase ?? { cod: true, online: true, min_qty: 1 },
  );

  const [status, setStatus] = useState<Product["status"]>(editing?.status ?? "active");
  const [scheduledAt, setScheduledAt] = useState<string>(meta0.visibility?.scheduled_at ?? "");
  const [isFeatured, setIsFeatured] = useState<boolean>(!!(editing as any)?.is_featured);
  const [labels, setLabels] = useState<string[]>(
    meta0.labels ?? ((editing as any)?.is_featured ? ["Featured"] : []),
  );

  const [related, setRelated] = useState<NonNullable<ProductMeta["related"]>>(
    meta0.related ?? { related: editing?.related_product_ids ?? [], fbt: [], cross: [], upsell: [] },
  );

  const [seo, setSeo] = useState<NonNullable<ProductMeta["seo"]>>(meta0.seo ?? {});

  const [warranty, setWarranty] = useState<string>((editing as any)?.warranty ?? (editing ? "" : productDefaults?.warranty ?? ""));
  const [returnPolicy, setReturnPolicy] = useState<string>((editing as any)?.return_policy ?? (editing ? "" : productDefaults?.return_policy ?? ""));
  const [shippingInfo, setShippingInfo] = useState<string>((editing as any)?.shipping_info ?? (editing ? "" : productDefaults?.shipping_info ?? ""));

  const [newCatName, setNewCatName] = useState("");

  // ---- digital product state (stored in meta.digital) ----
  const dig0 = (meta0.digital ?? {}) as DigitalMeta;
  const [digFiles, setDigFiles] = useState<DigitalFile[]>(dig0.files ?? []);
  const [digExternalUrl, setDigExternalUrl] = useState<string>(dig0.external_url ?? "");
  const [digVersion, setDigVersion] = useState<string>(dig0.version ?? "");
  const [digChangelog, setDigChangelog] = useState<string>(dig0.changelog ?? "");
  const [digPlatforms, setDigPlatforms] = useState<string[]>(dig0.platforms ?? []);
  const [digTags, setDigTags] = useState<string>((dig0.tags ?? []).join(", "));
  const [digPreviewImages, setDigPreviewImages] = useState<string[]>(dig0.preview?.images ?? []);
  const [digPreviewVideo, setDigPreviewVideo] = useState<string>(dig0.preview?.video_url ?? "");
  const [digDemoUrl, setDigDemoUrl] = useState<string>(dig0.preview?.demo_url ?? "");
  const [digMode, setDigMode] = useState<"instant" | "manual">(dig0.download?.mode ?? "instant");
  const [digMaxDownloads, setDigMaxDownloads] = useState<string>(
    dig0.download?.max_downloads != null ? String(dig0.download.max_downloads) : "",
  );
  const [digExpiryDays, setDigExpiryDays] = useState<string>(
    dig0.download?.expiry_days != null ? String(dig0.download.expiry_days) : "",
  );
  const [digAllowRedownload, setDigAllowRedownload] = useState<boolean>(dig0.download?.allow_redownload ?? true);
  const [digFree, setDigFree] = useState<boolean>(dig0.free ?? false);
  const [digSaleStart, setDigSaleStart] = useState<string>(dig0.sale_window?.start ?? "");
  const [digSaleEnd, setDigSaleEnd] = useState<string>(dig0.sale_window?.end ?? "");

  const [addingCat, setAddingCat] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- derived ----
  const isDigital = productType === "digital";

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent_id && c.parent_id === categoryId),
    [categories, categoryId],
  );
  const reg = Number(regularPrice) || 0;
  const sale = salePrice === "" ? null : Number(salePrice);
  const hasDiscount = sale != null && sale > 0 && sale < reg;
  const finalPrice = hasDiscount ? sale! : reg;
  const discountPct = hasDiscount ? Math.round(((reg - sale!) / reg) * 100) : 0;
  const profit = costPrice ? finalPrice - Number(costPrice) : null;
  const profitMargin = profit != null && finalPrice > 0 ? Math.round((profit / finalPrice) * 100) : null;

  // Related products list for pickers
  const { data: allProducts } = useQuery({
    queryKey: ["admin", "products", "picker"],
    queryFn: () => listProductsFn(),
    staleTime: 60_000,
  });
  const otherProducts = (allProducts ?? []).filter((p) => p.id !== editing?.id);

  // ---- category ops ----
  async function addCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const created = await createCat({ data: { name: newCatName.trim() } });
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      if (created && "id" in created) setCategoryId((created as any).id);
      setNewCatName("");
      toast.success("Category added");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAddingCat(false);
    }
  }

  function toggleLabel(l: string) {
    setLabels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
    if (l === "Featured") setIsFeatured((v) => !v);
  }

  function addVideo() {
    const url = videoInput.trim();
    if (!url) return;
    const provider = parseVideoUrl(url);
    if (!provider) {
      toast.error("Only YouTube or Facebook URLs allowed");
      return;
    }
    setVideos((v) => [...v, { url, provider, primary: v.length === 0 }]);
    setVideoInput("");
  }
  function removeVideo(i: number) {
    setVideos((v) => {
      const next = v.filter((_, idx) => idx !== i);
      if (!next.some((x) => x.primary) && next.length) next[0].primary = true;
      return next;
    });
  }
  function setPrimaryVideo(i: number) {
    setVideos((v) => v.map((x, idx) => ({ ...x, primary: idx === i })));
  }

  // ---- variant ops ----
  function addOption() {
    setVariants((v) => ({ ...v, options: [...v.options, { name: `Option ${v.options.length + 1}`, values: [] }] }));
  }
  function removeOption(idx: number) {
    setVariants((v) => {
      const options = v.options.filter((_, i) => i !== idx);
      return { options, items: buildMatrix(options, v.items) };
    });
  }
  function setOptionName(idx: number, name: string) {
    setVariants((v) => {
      const options = v.options.map((o, i) => (i === idx ? { ...o, name } : o));
      return { options, items: buildMatrix(options, v.items) };
    });
  }
  function setOptionValues(idx: number, csv: string) {
    const values = csv.split(",").map((s) => s.trim()).filter(Boolean);
    setVariants((v) => {
      const options = v.options.map((o, i) => (i === idx ? { ...o, values } : o));
      return { options, items: buildMatrix(options, v.items) };
    });
  }
  function updateItem(id: string, patch: Partial<VariantsV2["items"][number]>) {
    setVariants((v) => ({ ...v, items: v.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }

  // ---- submit ----
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isDigital) {
      if (!name.trim()) {
        toast.error("Enter a product name");
        return;
      }
      if (!categoryId) {
        toast.error("Select a category");
        return;
      }
      if (!image) {
        toast.error("Upload a product thumbnail");
        return;
      }
      if (!digFiles.length && !digExternalUrl.trim()) {
        toast.error("Add at least one digital file or an external download URL");
        return;
      }
      if (!digFree && (!regularPrice || reg <= 0)) {
        toast.error("Enter a price or enable Free product");
        return;
      }
    } else if (!regularPrice || reg <= 0) {
      toast.error("Enter a regular price");
      return;
    }
    if (sale != null && sale >= reg) {
      toast.error("Discount price must be less than regular price");
      return;
    }
    setSaving(true);
    try {
      const digital: DigitalMeta | undefined = isDigital
        ? {
            files: digFiles,
            external_url: digExternalUrl.trim() || null,
            version: digVersion.trim() || null,
            changelog: digChangelog.trim() || null,
            platforms: digPlatforms,
            tags: digTags.split(",").map((t) => t.trim()).filter(Boolean),
            preview: {
              images: digPreviewImages,
              video_url: digPreviewVideo.trim() || null,
              demo_url: digDemoUrl.trim() || null,
            },
            download: {
              mode: digMode,
              max_downloads: digMaxDownloads === "" ? null : Number(digMaxDownloads),
              expiry_days: digExpiryDays === "" ? null : Number(digExpiryDays),
              allow_redownload: digAllowRedownload,
            },
            free: digFree,
            sale_window: { start: digSaleStart || null, end: digSaleEnd || null },
          }
        : meta0.digital;

      const meta: ProductMeta = {
        product_type: productType,
        subcategory_id: subcategoryId || null,
        discount: hasDiscount ? { type: discountType, value: discountType === "percent" ? discountPct : reg - sale! } : null,
        tax: taxRate ? { rate: Number(taxRate), inclusive: taxInclusive } : null,
        barcode: barcode || null,
        inventory_status: inventoryStatus,
        stock_managed: isDigital ? false : stockManaged,
        shipping,
        purchase,
        labels,
        related,
        seo,
        videos,
        visibility: { scheduled_at: scheduledAt || null },
        ai_ready: { description: false, enhance: false, bg_removal: false, seo: false },
        ...(digital ? { digital } : {}),
      };
      const primaryVideoUrl = videos.find((v) => v.primary)?.url ?? videos[0]?.url ?? null;
      const digitalPrice = digFree ? 0 : finalPrice;
      await onSave({
        id: editing?.id,
        name,
        short_description: shortDesc || null,
        description: description || null,
        brand: brand || null,
        product_code: productCode || null,
        price: isDigital ? digitalPrice : finalPrice,
        old_price: hasDiscount && !(isDigital && digFree) ? reg : null,
        cost_price: costPrice === "" ? 0 : Number(costPrice),
        sku: sku || null,
        low_stock_threshold: Number(lowThreshold),
        stock: isDigital ? 0 : Number(stock),
        status,
        primary_image_url: image,
        gallery,
        video_url: primaryVideoUrl,
        category_id: categoryId || null,
        warranty: warranty || null,
        return_policy: returnPolicy || null,
        shipping_info: shippingInfo || null,
        is_featured: isFeatured,
        specifications: specs.filter((s) => s.key.trim()),
        variants,
        related_product_ids: related.related ?? [],
        product_type: productType,
        meta,
      });

    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ---- tab renderers ----
  const tabs = [
    {
      id: "general",
      label: "General",
      content: (
        <div className="space-y-4">
          <Field label="Product name" required>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product type">
              <select value={productType} onChange={(e) => setProductType(e.target.value as any)} className={selectCls}>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
                <option value="subscription" disabled>Subscription (Coming Soon)</option>
                <option value="service" disabled>Service (Coming Soon)</option>

              </select>
            </Field>
            <Field label="Brand">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Main category">
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                className={selectCls}
              >
                <option value="">— None —</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Subcategory">
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={!subCategories.length}
                className={selectCls}
              >
                <option value="">{subCategories.length ? "— None —" : "No subcategories"}</option>
                {subCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Quick-add category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="h-8"
            />
            <Button type="button" size="sm" variant="outline" onClick={addCategory} disabled={addingCat || !newCatName.trim()}>
              {addingCat ? "Adding…" : "Add"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU">
              <div className="flex gap-2">
                <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto if empty" />
                <Button type="button" size="sm" variant="outline" onClick={() => setSku(generateSku(name))}>Auto</Button>
              </div>
            </Field>
            <Field label="Product code">
              <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Short description">
            <Textarea rows={2} maxLength={500} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
          </Field>
          <Field label="Full description">
            <Suspense fallback={<Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />}>
              <RichTextEditor value={description} onChange={setDescription} />
            </Suspense>
          </Field>
        </div>
      ),
    },
    {
      id: "media",
      label: "Media",
      content: (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Primary image</Label>
              {image && (
                <button type="button" onClick={() => setCropTarget(image)} className="text-xs text-primary hover:underline">
                  <Crop className="mr-1 inline h-3 w-3" />Crop
                </button>
              )}
            </div>
            <ImageUploader storeId={storeId} value={image} onChange={setImage} />
          </div>

          <div>
            <Label>Gallery images</Label>
            <GalleryUploader storeId={storeId} value={gallery} onChange={setGallery} max={12} />
            {gallery.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {gallery.map((p) => (
                  <div key={p} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                    <span className="max-w-24 truncate">{p.split("/").pop()}</span>
                    <button type="button" onClick={() => setImage(p)} title="Set primary" className="hover:text-primary">
                      <Star className={`h-3 w-3 ${image === p ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </button>
                    <button type="button" onClick={() => setCropTarget(p)} title="Crop" className="hover:text-primary">
                      <Crop className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Images auto-compress and convert to WebP. Recommended min 800px on the long edge.</p>
          </div>

          <div>
            <Label>Product video URLs (YouTube or Facebook)</Label>
            <div className="mt-2 flex gap-2">
              <Input placeholder="https://youtube.com/watch?v=…  or  https://facebook.com/…" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} />
              <Button type="button" size="sm" onClick={addVideo}><Plus className="h-3 w-3" /></Button>
            </div>
            {videos.length > 0 && (
              <ul className="mt-2 space-y-2">
                {videos.map((v, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                    {v.provider === "youtube" ? <Youtube className="h-4 w-4 text-red-500" /> : <Facebook className="h-4 w-4 text-blue-600" />}
                    <span className="min-w-0 flex-1 truncate">{v.url}</span>
                    <button type="button" onClick={() => setPrimaryVideo(i)} title="Set primary">
                      <Star className={`h-3 w-3 ${v.primary ? "fill-yellow-500 text-yellow-500" : ""}`} />
                    </button>
                    <button type="button" onClick={() => removeVideo(i)} className="text-destructive"><X className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
            {videos.find((v) => v.primary) && (
              <div className="mt-3 aspect-video w-full overflow-hidden rounded-md border bg-black">
                <iframe
                  src={toEmbed(videos.find((v) => v.primary)!.url, videos.find((v) => v.primary)!.provider)}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "pricing",
      label: "Pricing",
      content: (
        <div className="space-y-4">
          {isDigital && (
            <label className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
              <span className="text-sm font-medium">Free product</span>
              <Switch checked={digFree} onCheckedChange={setDigFree} />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Regular price" required={!(isDigital && digFree)}>
              <Input
                type="number"
                min={0}
                step="0.01"
                required={!(isDigital && digFree)}
                disabled={isDigital && digFree}
                value={regularPrice}
                onChange={(e) => setRegularPrice(e.target.value)}
              />
            </Field>

            <Field label="Discount type">
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className={selectCls}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Discount price">
              <Input type="number" min={0} step="0.01" placeholder="Optional" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </Field>
            <Field label="Cost price (admin only)">
              <Input type="number" min={0} step="0.01" placeholder="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </Field>
          </div>
          {(hasDiscount || profit != null) && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              {hasDiscount && <p className="font-medium text-emerald-600">{discountPct}% off — customers save ৳{(reg - sale!).toFixed(0)}</p>}
              {profit != null && (
                <p className="text-muted-foreground">
                  Profit: ৳{profit.toFixed(0)} {profitMargin != null && `(${profitMargin}% margin)`}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tax rate (%)">
              <Input type="number" min={0} step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" />
            </Field>
            <label className="flex items-end gap-2 pb-1.5">
              <Switch checked={taxInclusive} onCheckedChange={setTaxInclusive} />
              <span className="text-sm">Tax inclusive in price</span>
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "inventory",
      label: "Inventory",
      content: (
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <Switch checked={stockManaged} onCheckedChange={setStockManaged} />
            <span className="text-sm">Manage stock quantity</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Stock">
              <Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} disabled={!stockManaged} />
            </Field>
            <Field label="Low stock alert">
              <Input type="number" min={0} value={lowThreshold} onChange={(e) => setLowThreshold(Number(e.target.value))} />
            </Field>
            <Field label="Inventory status">
              <select value={inventoryStatus} onChange={(e) => setInventoryStatus(e.target.value as any)} className={selectCls}>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="pre_order">Pre-order</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Barcode">
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="SKU">
              <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            </Field>
          </div>
        </div>
      ),
    },
    {
      id: "variants",
      label: "Variants",
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Options like Color, Size, Storage. Values are comma-separated.</p>
            <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus className="mr-1 h-3 w-3" />Option</Button>
          </div>
          {variants.options.map((opt, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input value={opt.name} onChange={(e) => setOptionName(i, e.target.value)} placeholder="Option name" />
              <Input value={opt.values.join(", ")} onChange={(e) => setOptionValues(i, e.target.value)} placeholder="Red, Blue, Green" />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {variants.items.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Variant</th>
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Price</th>
                    <th className="p-2 text-left">Discount</th>
                    <th className="p-2 text-left">Stock</th>
                    <th className="p-2 text-left">Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="p-2 font-medium">{Object.values(it.options).join(" / ")}</td>
                      <td className="p-2"><Input className="h-8" value={it.sku ?? ""} onChange={(e) => updateItem(it.id, { sku: e.target.value })} /></td>
                      <td className="p-2"><Input className="h-8 w-20" type="number" min={0} value={it.price ?? ""} onChange={(e) => updateItem(it.id, { price: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                      <td className="p-2"><Input className="h-8 w-20" type="number" min={0} value={it.discount ?? ""} onChange={(e) => updateItem(it.id, { discount: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                      <td className="p-2"><Input className="h-8 w-20" type="number" min={0} value={it.stock ?? ""} onChange={(e) => updateItem(it.id, { stock: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                      <td className="p-2"><Input className="h-8" value={it.barcode ?? ""} onChange={(e) => updateItem(it.id, { barcode: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "attributes",
      label: "Attributes",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Custom attributes — Material, Color, Origin, etc.</p>
          {specs.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input value={s.key} onChange={(e) => setSpecs(specs.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))} placeholder="Attribute" />
              <Input value={s.value} onChange={(e) => setSpecs(specs.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" />
              <Button type="button" size="sm" variant="ghost" onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setSpecs([...specs, { key: "", value: "" }])}><Plus className="mr-1 h-3 w-3" />Add attribute</Button>
        </div>
      ),
    },
    {
      id: "shipping",
      label: "Shipping",
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Weight (kg)"><Input type="number" min={0} step="0.01" value={shipping.weight ?? ""} onChange={(e) => setShipping({ ...shipping, weight: Number(e.target.value) || undefined })} /></Field>
            <Field label="Length (cm)"><Input type="number" min={0} step="0.1" value={shipping.l ?? ""} onChange={(e) => setShipping({ ...shipping, l: Number(e.target.value) || undefined })} /></Field>
            <Field label="Width (cm)"><Input type="number" min={0} step="0.1" value={shipping.w ?? ""} onChange={(e) => setShipping({ ...shipping, w: Number(e.target.value) || undefined })} /></Field>
            <Field label="Height (cm)"><Input type="number" min={0} step="0.1" value={shipping.h ?? ""} onChange={(e) => setShipping({ ...shipping, h: Number(e.target.value) || undefined })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shipping type">
              <select value={shipping.type ?? "free"} onChange={(e) => setShipping({ ...shipping, type: e.target.value as any })} className={selectCls}>
                <option value="free">Free shipping</option>
                <option value="fixed">Fixed shipping charge</option>
                <option value="calculated">Calculated at checkout</option>
              </select>
            </Field>
            {shipping.type === "fixed" && (
              <Field label="Fixed rate (৳)">
                <Input type="number" min={0} value={shipping.rate ?? ""} onChange={(e) => setShipping({ ...shipping, rate: Number(e.target.value) || undefined })} />
              </Field>
            )}
          </div>
          <Field label="Shipping information (shown on product page)">
            <Textarea rows={2} value={shippingInfo} onChange={(e) => setShippingInfo(e.target.value)} />
          </Field>
        </div>
      ),
    },
    {
      id: "purchase",
      label: "Purchase",
      content: (
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <Switch checked={!!purchase.cod} onCheckedChange={(v) => setPurchase({ ...purchase, cod: v })} />
            <span className="text-sm">Allow Cash on Delivery</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={!!purchase.online} onCheckedChange={(v) => setPurchase({ ...purchase, online: v })} />
            <span className="text-sm">Allow online payment</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum purchase quantity">
              <Input type="number" min={1} value={purchase.min_qty ?? 1} onChange={(e) => setPurchase({ ...purchase, min_qty: Number(e.target.value) })} />
            </Field>
            <Field label="Maximum purchase quantity">
              <Input type="number" min={0} value={purchase.max_qty ?? ""} onChange={(e) => setPurchase({ ...purchase, max_qty: Number(e.target.value) || undefined })} placeholder="No limit" />
            </Field>
          </div>
          <Field label="Warranty"><Textarea rows={2} value={warranty} onChange={(e) => setWarranty(e.target.value)} /></Field>
          <Field label="Return policy"><Textarea rows={2} value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} /></Field>
        </div>
      ),
    },
    {
      id: "visibility",
      label: "Visibility & Labels",
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={selectCls}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="out_of_stock">Hidden / Out of stock</option>
              </select>
            </Field>
            <Field label="Scheduled publish">
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
          </div>
          <div>
            <Label>Labels</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LABEL_OPTIONS.map((l) => {
                const on = labels.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLabel(l)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "related",
      label: "Related",
      content: (
        <div className="space-y-4">
          {(["related", "fbt", "cross", "upsell"] as const).map((key) => (
            <ProductPicker
              key={key}
              label={
                key === "related" ? "Related products" :
                key === "fbt" ? "Frequently bought together" :
                key === "cross" ? "Cross-sell" : "Upsell"
              }
              products={otherProducts}
              value={related[key] ?? []}
              onChange={(next) => setRelated({ ...related, [key]: next })}
            />
          ))}
        </div>
      ),
    },
    {
      id: "seo",
      label: "SEO",
      content: (
        <div className="space-y-4">
          <Field label="SEO title"><Input value={seo.title ?? ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} maxLength={70} /></Field>
          <Field label="Meta description"><Textarea rows={3} maxLength={200} value={seo.description ?? ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} /></Field>
          <Field label="Keywords"><Input value={seo.keywords ?? ""} onChange={(e) => setSeo({ ...seo, keywords: e.target.value })} placeholder="Comma separated" /></Field>
          <Field label="URL slug"><Input value={seo.slug ?? ""} onChange={(e) => setSeo({ ...seo, slug: e.target.value })} placeholder="auto-generated if empty" /></Field>
        </div>
      ),
    },
    {
      id: "ai",
      label: "AI (Coming Soon)",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">These will be enabled in a future update.</p>
          {["AI Product Description", "AI Image Enhancement", "AI Background Removal", "AI SEO Generation"].map((l) => (
            <label key={l} className="flex items-center gap-2 opacity-60">
              <Switch disabled />
              <span className="text-sm">{l}</span>
            </label>
          ))}
        </div>
      ),
    },
  ] as const;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-full sm:max-w-4xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b p-3 pr-10 sm:p-4 sm:pr-12">
            <DialogTitle className="truncate text-sm font-semibold sm:text-base">
              {editing ? "Edit product" : "New product"}
            </DialogTitle>
            {labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {labels.map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>
                ))}
              </div>
            )}
          </DialogHeader>

          <WizardForm
            tabs={tabs as any}
            saving={saving}
            editing={!!editing}
            onSubmit={submit}
            onCancel={onClose}
            footerInfo={
              <>
                {finalPrice > 0 && `৳${finalPrice.toFixed(0)}`}
                {stockManaged && ` · Stock ${stock}`}
              </>
            }
          />

        </DialogContent>
      </Dialog>
      {cropTarget && (
        <Suspense fallback={null}>
          <CropDialog
            path={cropTarget}
            onClose={() => setCropTarget(null)}
            onSaved={(newPath) => {
              if (image === cropTarget) setImage(newPath);
              setGallery((g) => g.map((p) => (p === cropTarget ? newPath : p)));
              setCropTarget(null);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

const selectCls = "flex h-9 w-full rounded-md border bg-background px-3 text-sm";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ProductPicker({
  label,
  products,
  value,
  onChange,
}: {
  label: string;
  products: Product[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const shown = q ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const selected = products.filter((p) => value.includes(p.id));
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>{label}</Label>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-8" />
      {shown.length > 0 && (
        <ul className="max-h-40 divide-y overflow-y-auto rounded-md border bg-background text-xs">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted ${value.includes(p.id) ? "bg-muted" : ""}`}
              >
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-muted-foreground">৳{Number(p.price).toFixed(0)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1">
              {p.name}
              <button type="button" onClick={() => toggle(p.id)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function WizardForm({
  tabs,
  saving,
  editing,
  onSubmit,
  onCancel,
  footerInfo,
}: {
  tabs: ReadonlyArray<{ id: string; label: string; content: React.ReactNode }>;
  saving: boolean;
  editing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  footerInfo: React.ReactNode;
}) {
  const [step, setStep] = useState(0);
  const total = tabs.length;
  const current = tabs[step];
  const isLast = step === total - 1;
  const progress = Math.round(((step + 1) / total) * 100);

  function goNext(e: React.MouseEvent) {
    e.preventDefault();
    if (!isLast) setStep((s) => Math.min(total - 1, s + 1));
  }
  function goBack(e: React.MouseEvent) {
    e.preventDefault();
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] sm:text-xs">
          <span className="truncate pr-2 font-medium">
            Step {step + 1}/{total} — <span className="text-primary">{current.label}</span>
          </span>
          <span className="shrink-0 text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="mt-2 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStep(i)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors sm:px-3 sm:text-[11px] ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {done && <Check className="mr-1 inline h-3 w-3" />}
                {i + 1}. {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div key={current.id}>{current.content}</div>
      </div>

      <div className="shrink-0 border-t bg-muted/30 p-2.5 sm:p-4">
        <p className="mb-2 hidden text-xs text-muted-foreground sm:block">{footerInfo}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goBack}
            disabled={step === 0}
            className="flex-1 sm:flex-none sm:size-default"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {isLast ? (
            <Button type="submit" size="sm" disabled={saving} className="flex-1 sm:flex-none sm:size-default">
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={goNext} className="flex-1 sm:flex-none sm:size-default">
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
