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
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/store-template")({
  component: StoreTemplatePage,
});

type TemplateForm = {
  description: string;
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
  categories: Array<{ name: string }>;
  products: Array<{
    name: string;
    description?: string;
    price?: number;
    stock?: number;
    image_url?: string;
    category_name?: string;
    is_active?: boolean;
  }>;
  pages: Array<{ slug: string; title: string; content: string }>;
};

const empty: TemplateForm = {
  description: "",
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

  const colors: Array<[keyof TemplateForm, string]> = [
    ["primary_color", "Primary"],
    ["header_color", "Header"],
    ["title_bar_color", "Product Card"],
    ["footer_color", "Footer"],
    ["button_color", "Button"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Global Store Template</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The blueprint every newly created store inherits. Existing stores keep their current setup unless their
          admin taps "Reset to Default Template".
        </p>
      </div>

      <Tabs defaultValue="design">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="header">Header / Footer</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {colors.map(([k, label]) => (
              <div key={k as string} className="space-y-1.5">
                <Label>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(form as any)[k] || "#000000"}
                    onChange={(e) => set(k, e.target.value as any)}
                    className="h-10 w-14 rounded-md border"
                  />
                  <Input value={(form as any)[k] || ""} onChange={(e) => set(k, e.target.value as any)} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Border radius — {form.theme.radius ?? 8}px</Label>
            <input
              type="range"
              min={0}
              max={24}
              value={form.theme.radius ?? 8}
              onChange={(e) => set("theme", { ...form.theme, radius: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </TabsContent>

        <TabsContent value="header" className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label>Default store description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Shown in the footer of every new store."
            />
          </div>
        </TabsContent>

        <TabsContent value="banners" className="space-y-4 rounded-xl border bg-card p-4">
          {form.banners.map((b, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_80px_auto]">
              <Input
                placeholder="Image URL"
                value={b.image_url}
                onChange={(e) => {
                  const arr = [...form.banners];
                  arr[i] = { ...b, image_url: e.target.value };
                  set("banners", arr);
                }}
              />
              <Input
                placeholder="Link (optional)"
                value={b.link_url ?? ""}
                onChange={(e) => {
                  const arr = [...form.banners];
                  arr[i] = { ...b, link_url: e.target.value };
                  set("banners", arr);
                }}
              />
              <Input
                type="number"
                placeholder="#"
                value={b.sort_order ?? i}
                onChange={(e) => {
                  const arr = [...form.banners];
                  arr[i] = { ...b, sort_order: Number(e.target.value) };
                  set("banners", arr);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => set("banners", form.banners.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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

        <TabsContent value="categories" className="space-y-4 rounded-xl border bg-card p-4">
          {form.categories.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={c.name}
                placeholder="Category name"
                onChange={(e) => {
                  const arr = [...form.categories];
                  arr[i] = { name: e.target.value };
                  set("categories", arr);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => set("categories", form.categories.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => set("categories", [...form.categories, { name: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add category
          </Button>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 rounded-xl border bg-card p-4">
          {form.products.map((p, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Product name"
                  value={p.name}
                  onChange={(e) => {
                    const arr = [...form.products];
                    arr[i] = { ...p, name: e.target.value };
                    set("products", arr);
                  }}
                />
                <Input
                  placeholder="Category name (must match)"
                  value={p.category_name ?? ""}
                  onChange={(e) => {
                    const arr = [...form.products];
                    arr[i] = { ...p, category_name: e.target.value };
                    set("products", arr);
                  }}
                />
                <Input
                  placeholder="Image URL"
                  value={p.image_url ?? ""}
                  onChange={(e) => {
                    const arr = [...form.products];
                    arr[i] = { ...p, image_url: e.target.value };
                    set("products", arr);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Price"
                    value={p.price ?? ""}
                    onChange={(e) => {
                      const arr = [...form.products];
                      arr[i] = { ...p, price: Number(e.target.value) };
                      set("products", arr);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Stock"
                    value={p.stock ?? ""}
                    onChange={(e) => {
                      const arr = [...form.products];
                      arr[i] = { ...p, stock: Number(e.target.value) };
                      set("products", arr);
                    }}
                  />
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder="Description"
                value={p.description ?? ""}
                onChange={(e) => {
                  const arr = [...form.products];
                  arr[i] = { ...p, description: e.target.value };
                  set("products", arr);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("products", form.products.filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => set("products", [...form.products, { name: "", price: 0, stock: 0, is_active: true }])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Button>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4 rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Stored for use when the Pages feature ships. Values are copied to new stores.
          </p>
          {form.pages.map((p, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Slug (e.g. about)"
                  value={p.slug}
                  onChange={(e) => {
                    const arr = [...form.pages];
                    arr[i] = { ...p, slug: e.target.value };
                    set("pages", arr);
                  }}
                />
                <Input
                  placeholder="Title"
                  value={p.title}
                  onChange={(e) => {
                    const arr = [...form.pages];
                    arr[i] = { ...p, title: e.target.value };
                    set("pages", arr);
                  }}
                />
              </div>
              <Textarea
                rows={4}
                placeholder="Content"
                value={p.content}
                onChange={(e) => {
                  const arr = [...form.pages];
                  arr[i] = { ...p, content: e.target.value };
                  set("pages", arr);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("pages", form.pages.filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => set("pages", [...form.pages, { slug: "", title: "", content: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add page
          </Button>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label>Default warranty</Label>
            <Textarea
              rows={2}
              value={form.product_defaults.warranty ?? ""}
              onChange={(e) => set("product_defaults", { ...form.product_defaults, warranty: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default return policy</Label>
            <Textarea
              rows={2}
              value={form.product_defaults.return_policy ?? ""}
              onChange={(e) => set("product_defaults", { ...form.product_defaults, return_policy: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default shipping info</Label>
            <Textarea
              rows={2}
              value={form.product_defaults.shipping_info ?? ""}
              onChange={(e) => set("product_defaults", { ...form.product_defaults, shipping_info: e.target.value })}
            />
          </div>
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
