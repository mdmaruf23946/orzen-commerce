import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, ChevronDown, PenLine, Package, Download, CalendarClock, Repeat } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "@/components/admin/product-form/ProductDialog";
import { ServiceProductDialog } from "@/components/admin/product-form/service/ServiceProductDialog";
import { SubscriptionProductDialog } from "@/components/admin/product-form/subscription/SubscriptionProductDialog";

import { AIProductBuilderDialog } from "@/components/admin/product-form/AIProductBuilderDialog";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";
import { ProductRow, productTypeOf, type ProductType } from "@/components/admin/products/ProductRow";
import { typeScopeCounts } from "@/lib/admin.functions";
import { useProductTypeScope, scopeTabs, type ProductTypeScope } from "@/lib/product-type-scope";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Products · Store Admin" },
      { name: "description", content: "Manage physical, digital, service and subscription products in one place." },
    ],
  }),
});

type Product = Awaited<ReturnType<typeof listMyProducts>>[number];
type TabKey = ProductTypeScope;

const TYPES: ProductType[] = ["physical", "digital", "service", "subscription"];
const TYPE_LABEL: Record<ProductType, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

const selectCls =
  "h-10 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ProductsPage() {
  const list = useServerFn(listMyProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const bulkUpd = useServerFn(bulkUpdateProducts);
  const bulkDel = useServerFn(bulkDeleteProducts);
  const storeFn = useServerFn(getMyStore);
  const catsFn = useServerFn(listMyCategories);
  const countsFn = useServerFn(typeScopeCounts);
  const qc = useQueryClient();
  const { scope, setScope, filter, activeType: scopeType } = useProductTypeScope();
  const tab = scope;
  const { data: products } = useQuery({
    queryKey: ["admin", "products", filter ?? "all"],
    queryFn: () => list({ data: { product_type: filter } } as any),
  });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const { data: categories } = useQuery({
    queryKey: ["admin", "categories", filter ?? "all"],
    queryFn: () => catsFn({ data: { product_type: filter } } as any),
  });
  const { data: typeCounts } = useQuery({
    queryKey: ["admin", "counts", "products"],
    queryFn: () => countsFn({ data: { entity: "products" } }),
  });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "name" | "price_asc" | "price_desc">("newest");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<ProductType>("physical");
  const [aiOpen, setAiOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"" | "delete" | "category" | "price" | "stock" | "status">("");
  const [bulkValue, setBulkValue] = useState<any>("");

  const all = (products ?? []) as any[];
  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories ?? []) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const counts = typeCounts ?? { all: all.length, physical: 0, digital: 0, service: 0, subscription: 0 };

  const tabs = useMemo(() => scopeTabs(counts as Record<string, number>), [counts]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = all.filter((p) => (tab === "all" ? true : productTypeOf(p) === tab));
    if (term) {
      rows = rows.filter((p) => {
        const cat = p.category_id ? (catName.get(p.category_id) ?? "") : "";
        return [p.name, p.sku, cat, productTypeOf(p)]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(term));
      });
    }
    if (statusFilter) rows = rows.filter((p) => p.status === statusFilter);
    if (categoryFilter) rows = rows.filter((p) => p.category_id === categoryFilter);
    const sorted = [...rows];
    if (sort === "name") sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    return sorted;
  }, [all, tab, q, statusFilter, categoryFilter, sort, catName]);

  const stats = useMemo(() => {
    const rows = all;
    const active = rows.filter((p) => p.status === "active").length;
    const base = [
      { label: "Total", value: rows.length, icon: Package },
      { label: "Active", value: active, icon: Package },
    ];
    if (tab === "digital")
      return [
        ...base,
        { label: "Downloads", value: rows.reduce((s, p) => s + (p.download_count ?? 0), 0), icon: Download },
      ];
    if (tab === "subscription")
      return [
        ...base,
        { label: "Subscribers", value: rows.reduce((s, p) => s + (p.active_subscribers ?? 0), 0), icon: Repeat },
      ];
    if (tab === "service")
      return [
        ...base,
        {
          label: "Scheduled",
          value: rows.filter((p) => (p.meta?.service?.booking_type ?? "scheduled") === "scheduled").length,
          icon: CalendarClock,
        },
      ];
    return [
      ...base,
      { label: "Out of stock", value: rows.filter((p) => Number(p.stock ?? 0) <= 0).length, icon: Package },
    ];
  }, [all, tab]);

  function startNew(type: ProductType) {
    setEditing(null);
    setNewType(type);
    setOpen(true);
  }
  function startEdit(p: Product) {
    setEditing(p);
    setOpen(true);
  }
  function toggleAll() {
    const ids = filtered.map((p) => p.id);
    setSelected(selected.size === ids.length ? new Set() : new Set(ids));
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
  async function applyBulk(action?: typeof bulkAction, value?: any) {
    const act = action ?? bulkAction;
    const val = value ?? bulkValue;
    const ids = Array.from(selected);
    if (!ids.length || !act) return;
    try {
      if (act === "delete") {
        if (!confirm(`Delete ${ids.length} products?`)) return;
        await bulkDel({ data: { ids } });
      } else {
        const patch: any = {};
        if (act === "category") patch.category_id = val || null;
        if (act === "price") patch.price = Number(val);
        if (act === "stock") patch.stock = Number(val);
        if (act === "status") patch.status = val;
        await bulkUpd({ data: { ids, patch } });
      }
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setSelected(new Set());
      setBulkAction("");
      setBulkValue("");
      toast.success(`Updated ${ids.length} products`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const allChecked = filtered.length > 0 && selected.size === filtered.length;

  const activeType: ProductType = scopeType;
  const typeNoun =
    activeType === "subscription" ? "Subscription Plan" : activeType === "service" ? "Service" : `${TYPE_LABEL[activeType]} Product`;

  const addButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add {typeNoun}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => startNew(activeType)} className="gap-2">
          <PenLine className="h-4 w-4" />
          <span className="text-sm font-medium">Add {typeNoun}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setAiOpen(true)} className="gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">AI Assistant</span>
            <span className="text-xs text-muted-foreground">Generate {typeNoun}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Products"
        description={`Current type: ${TYPE_LABEL[activeType]}${tab === "all" ? " (showing all products)" : ""}`}
        action={addButton}
      />


      <TypeFilterTabs
        tabs={tabs}
        value={tab}
        onChange={(k) => {
          setScope(k);
          setCategoryFilter("");
          setSelected(new Set());
        }}
      />

      <AdminToolbar
        value={q}
        onChange={setQ}
        placeholder="Search by name, SKU, category or type…"
        action={addButton}
        trailing={
          <div className="flex gap-2 overflow-x-auto">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectCls}>
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={selectCls}>
              <option value="newest">Newest</option>
              <option value="name">Name A–Z</option>
              <option value="price_asc">Price low → high</option>
              <option value="price_desc">Price high → low</option>
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
            <p className="mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm md:top-0">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => applyBulk("status", "active")}>
            Enable
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyBulk("status", "draft")}>
            Disable
          </Button>
          <select
            value={bulkAction}
            onChange={(e) => {
              setBulkAction(e.target.value as any);
              setBulkValue("");
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">Action…</option>
            <option value="delete">Delete</option>
            <option value="category">Change category</option>
            <option value="price">Update price</option>
            <option value="stock">Update stock</option>
            <option value="status">Change status</option>
          </select>
          {bulkAction === "category" && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">— No category —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {(bulkAction === "price" || bulkAction === "stock") && (
            <Input
              type="number"
              min={0}
              className="h-8 w-28 text-xs"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
            />
          )}
          {bulkAction === "status" && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Select…</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          )}
          <Button
            size="sm"
            onClick={() => applyBulk()}
            disabled={!bulkAction || (bulkAction !== "delete" && bulkValue === "")}
          >
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {q || statusFilter || categoryFilter
                ? "No products match your search."
                : tab === "all"
                  ? "No products yet."
                  : `No ${TYPE_LABEL[tab as ProductType].toLowerCase()} products yet.`}
            </p>
            <Button size="sm" onClick={() => startNew(tab === "all" ? "physical" : (tab as ProductType))}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add {tab === "all" ? "product" : TYPE_LABEL[tab as ProductType].toLowerCase()}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b bg-muted/30 p-3 text-xs text-muted-foreground">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4" />
              <span>Select all ({filtered.length})</span>
            </div>
            <ul className="divide-y">
              {filtered.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  selected={selected.has(p.id)}
                  showTypeBadge={tab === "all"}
                  onToggle={() => toggleOne(p.id)}
                  onEdit={() => startEdit(p)}
                  onDelete={() => remove(p.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {open && store && (editing ? productTypeOf(editing) === "service" : newType === "service") && (
        <ServiceProductDialog
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

      {open && store && (editing ? productTypeOf(editing) === "subscription" : newType === "subscription") && (
        <SubscriptionProductDialog
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

      {open &&
        store &&
        !["service", "subscription"].includes(editing ? productTypeOf(editing) : newType) && (
          <ProductDialog
            storeId={store.id}
            editing={editing}
            categories={categories ?? []}
            productDefaults={(store as any).product_defaults ?? null}
            initialType={newType}
            onClose={() => setOpen(false)}
            onSave={async (data) => {
              await save({ data });
              qc.invalidateQueries({ queryKey: ["admin", "products"] });
              toast.success("Saved");
              setOpen(false);
            }}
          />
        )}



      {aiOpen && store && (
        <AIProductBuilderDialog
          storeId={store.id}
          categories={categories ?? []}
          productDefaults={(store as any).product_defaults ?? null}
          productType={activeType}
          onClose={() => setAiOpen(false)}
          onSave={async (data) => {
            await save({ data });
            qc.invalidateQueries({ queryKey: ["admin", "products"] });
            toast.success("Saved");
            setAiOpen(false);
          }}
        />
      )}
    </div>
  );
}
