import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  listMyProducts,
  upsertProduct,
  deleteProduct,
  getMyStore,
  listMyCategories,
  upsertCategory,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { GalleryUploader } from "@/components/admin/GalleryUploader";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type Product = Awaited<ReturnType<typeof listMyProducts>>[number];
type Category = Awaited<ReturnType<typeof listMyCategories>>[number];

function ProductsPage() {
  const list = useServerFn(listMyProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const storeFn = useServerFn(getMyStore);
  const catsFn = useServerFn(listMyCategories);
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: () => list() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const { data: categories } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => catsFn() });
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  function startNew() {
    setEditing(null);
    setOpen(true);
  }
  function startEdit(p: Product) {
    setEditing(p);
    setOpen(true);
  }
  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    toast.success("Deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> Add product
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {(products ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No products yet.</div>
        ) : (
          <ul className="divide-y">
            {(products ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.primary_image_url && (
                    <img
                      src={p.primary_image_url.startsWith("http") ? p.primary_image_url : `/api/img/${p.primary_image_url}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ৳{Number(p.price).toFixed(0)}
                    {p.old_price && Number(p.old_price) > Number(p.price) && (
                      <span className="ml-1 line-through">৳{Number(p.old_price).toFixed(0)}</span>
                    )}
                    {" · "}Stock {p.stock} · {p.status}
                  </p>
                </div>
                <button onClick={() => startEdit(p)} className="rounded p-2 hover:bg-muted" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(p.id)} className="rounded p-2 hover:bg-destructive/10 text-destructive" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && store && (
        <ProductDialog
          storeId={store.id}
          editing={editing}
          categories={categories ?? []}
          productDefaults={(store as any).product_defaults ?? null}
          onClose={() => setOpen(false)}
          onSave={async (data) => {
            await save({ data });
            qc.invalidateQueries({ queryKey: ["admin", "products"] });
            toast.success("Saved");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ProductDialog({
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
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  // UX: "Regular price" = old_price (original), "Sale price" = price (active selling)
  const [regularPrice, setRegularPrice] = useState<string>(
    editing?.old_price != null ? String(editing.old_price) : editing ? String(editing.price) : "",
  );
  const [salePrice, setSalePrice] = useState<string>(
    editing?.old_price != null ? String(editing.price) : "",
  );
  const [stock, setStock] = useState(editing?.stock ?? 0);
  const [status, setStatus] = useState<Product["status"]>(editing?.status ?? "active");
  const [image, setImage] = useState<string | null>(editing?.primary_image_url ?? null);
  const [gallery, setGallery] = useState<string[]>(
    Array.isArray(editing?.gallery) ? (editing!.gallery as string[]) : [],
  );
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? "");
  const [warranty, setWarranty] = useState<string>(
    (editing as any)?.warranty ?? (editing ? "" : productDefaults?.warranty ?? ""),
  );
  const [returnPolicy, setReturnPolicy] = useState<string>(
    (editing as any)?.return_policy ?? (editing ? "" : productDefaults?.return_policy ?? ""),
  );
  const [shippingInfo, setShippingInfo] = useState<string>(
    (editing as any)?.shipping_info ?? (editing ? "" : productDefaults?.shipping_info ?? ""),
  );
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const reg = Number(regularPrice) || 0;
  const sale = salePrice === "" ? null : Number(salePrice);
  const hasDiscount = sale != null && sale > 0 && sale < reg;
  const discountPct = hasDiscount ? Math.round(((reg - sale!) / reg) * 100) : 0;

  async function addCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const created = await createCat({ data: { name: newCatName.trim() } });
      await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      if (created && "id" in created) setCategoryId(created.id);
      setNewCatName("");
      toast.success("Category added");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAddingCat(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!regularPrice || reg <= 0) {
      toast.error("Enter a regular price");
      return;
    }
    if (sale != null && sale >= reg) {
      toast.error("Sale price must be less than regular price");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        name,
        description: description || null,
        // active selling price → price; original → old_price (only when discounted)
        price: hasDiscount ? sale : reg,
        old_price: hasDiscount ? reg : null,
        stock: Number(stock),
        status,
        primary_image_url: image,
        gallery,
        category_id: categoryId || null,
        warranty: warranty || null,
        return_policy: returnPolicy || null,
        shipping_info: shippingInfo || null,
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
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Main image</Label>
            <ImageUploader storeId={storeId} value={image} onChange={setImage} />
          </div>

          <div className="space-y-1.5">
            <Label>Gallery images</Label>
            <GalleryUploader storeId={storeId} value={gallery} onChange={setGallery} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n">Name</Label>
            <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat">Category</Label>
            <select
              id="cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— No category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="h-8"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCategory}
                disabled={addingCat || !newCatName.trim()}
              >
                {addingCat ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp">Regular price</Label>
              <Input
                id="rp"
                type="number"
                min={0}
                step="0.01"
                required
                value={regularPrice}
                onChange={(e) => setRegularPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">Discount price</Label>
              <Input
                id="sp"
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
          </div>
          {hasDiscount && (
            <p className="text-xs font-medium text-emerald-600">
              {discountPct}% off — customers save ৳{(reg - sale!).toFixed(0)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s">Stock</Label>
              <Input id="s" type="number" min={0} required value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st">Status</Label>
              <select
                id="st"
                value={status}
                onChange={(e) => setStatus(e.target.value as Product["status"])}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d">Description</Label>
            <Textarea id="d" rows={4} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
