import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import {
  listMyProducts,
  upsertProduct,
  deleteProduct,
  getMyStore,
  listMyCategories,
} from "@/lib/admin.functions";
import { bulkUpdateProducts, bulkDeleteProducts } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "@/components/admin/product-form/ProductDialog";
import { AIProductBuilderDialog } from "@/components/admin/product-form/AIProductBuilderDialog";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type Product = Awaited<ReturnType<typeof listMyProducts>>[number];


function ProductsPage() {
  const list = useServerFn(listMyProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const bulkUpd = useServerFn(bulkUpdateProducts);
  const bulkDel = useServerFn(bulkDeleteProducts);
  const storeFn = useServerFn(getMyStore);
  const catsFn = useServerFn(listMyCategories);
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: () => list() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const { data: categories } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => catsFn() });
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"" | "delete" | "category" | "price" | "stock" | "status">("");
  const [bulkValue, setBulkValue] = useState<any>("");

  function startNew() { setEditing(null); setOpen(true); }
  function startEdit(p: Product) { setEditing(p); setOpen(true); }
  function toggleAll() {
    const all = (products ?? []).map((p) => p.id);
    setSelected(selected.size === all.length ? new Set() : new Set(all));
  }
  function toggleOne(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }
  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    toast.success("Deleted");
  }
  async function applyBulk() {
    const ids = Array.from(selected);
    if (!ids.length || !bulkAction) return;
    try {
      if (bulkAction === "delete") {
        if (!confirm(`Delete ${ids.length} products?`)) return;
        await bulkDel({ data: { ids } });
      } else {
        const patch: any = {};
        if (bulkAction === "category") patch.category_id = bulkValue || null;
        if (bulkAction === "price") patch.price = Number(bulkValue);
        if (bulkAction === "stock") patch.stock = Number(bulkValue);
        if (bulkAction === "status") patch.status = bulkValue;
        await bulkUpd({ data: { ids, patch } });
      }
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setSelected(new Set()); setBulkAction(""); setBulkValue("");
      toast.success(`Updated ${ids.length} products`);
    } catch (e) { toast.error((e as Error).message); }
  }

  const allChecked = (products ?? []).length > 0 && selected.size === (products ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Builder
          </Button>
          <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" />Add product</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm md:top-0">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value as any); setBulkValue(""); }} className="h-8 rounded-md border bg-background px-2 text-xs">
            <option value="">Action…</option>
            <option value="delete">Delete</option>
            <option value="category">Change category</option>
            <option value="price">Update price</option>
            <option value="stock">Update stock</option>
            <option value="status">Change status</option>
          </select>
          {bulkAction === "category" && (
            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">— No category —</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {(bulkAction === "price" || bulkAction === "stock") && (
            <Input type="number" min={0} className="h-8 w-28 text-xs" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
          )}
          {bulkAction === "status" && (
            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">Select…</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          )}
          <Button size="sm" onClick={applyBulk} disabled={!bulkAction || (bulkAction !== "delete" && bulkValue === "")}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {(products ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No products yet.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b bg-muted/30 p-3 text-xs text-muted-foreground">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              <span>Select all</span>
            </div>
            <ul className="divide-y">
              {(products ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.primary_image_url && (
                      <img src={p.primary_image_url.startsWith("http") ? p.primary_image_url : `/api/img/${p.primary_image_url}`} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ৳{Number(p.price).toFixed(0)}
                      {p.old_price && Number(p.old_price) > Number(p.price) && <span className="ml-1 line-through">৳{Number(p.old_price).toFixed(0)}</span>}
                      {" · "}Stock {p.stock} · {p.status}
                    </p>
                  </div>
                  <button onClick={() => startEdit(p)} className="rounded p-2 hover:bg-muted" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p.id)} className="rounded p-2 text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </>
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

