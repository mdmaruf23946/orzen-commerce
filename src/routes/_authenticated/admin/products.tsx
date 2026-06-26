import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listMyProducts, upsertProduct, deleteProduct, getMyStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type Product = Awaited<ReturnType<typeof listMyProducts>>[number];

function ProductsPage() {
  const list = useServerFn(listMyProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const storeFn = useServerFn(getMyStore);
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: () => list() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
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
                    ৳{Number(p.price).toFixed(0)} · Stock {p.stock} · {p.status}
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
  onClose,
  onSave,
}: {
  storeId: string;
  editing: Product | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [price, setPrice] = useState(editing?.price ?? 0);
  const [oldPrice, setOldPrice] = useState(editing?.old_price ?? "");
  const [stock, setStock] = useState(editing?.stock ?? 0);
  const [status, setStatus] = useState<Product["status"]>(editing?.status ?? "active");
  const [image, setImage] = useState<string | null>(editing?.primary_image_url ?? null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        name,
        description: description || null,
        price: Number(price),
        old_price: oldPrice === "" ? null : Number(oldPrice),
        stock: Number(stock),
        status,
        primary_image_url: image,
        gallery: [],
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
            <Label>Image</Label>
            <ImageUploader storeId={storeId} value={image} onChange={setImage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n">Name</Label>
            <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p">Price</Label>
              <Input id="p" type="number" min={0} step="0.01" required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op">Old price</Label>
              <Input id="op" type="number" min={0} step="0.01" value={oldPrice as any} onChange={(e) => setOldPrice(e.target.value as any)} />
            </div>
          </div>
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
