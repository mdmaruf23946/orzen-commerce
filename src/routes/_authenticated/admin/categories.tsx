import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, ImageIcon, Eye, EyeOff, Search } from "lucide-react";
import {
  listMyCategories,
  listMyProducts,
  upsertCategory,
  deleteCategory,
  reorderCategories,
  getMyStore,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

type Category = Awaited<ReturnType<typeof listMyCategories>>[number];

const TABS = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function typeOf(c: Category): string {
  const t = ((c as any).product_type ?? "").toString().trim().toLowerCase();
  // Legacy rows stored "both" or nothing — treat them as physical.
  if (!t || t === "both") return "physical";
  return t;
}

function matchesTab(c: Category, tab: TabKey) {
  if (tab === "all") return true;
  return typeOf(c) === tab;
}

function CategoriesPage() {
  const list = useServerFn(listMyCategories);
  const productsFn = useServerFn(listMyProducts);
  const save = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const reorder = useServerFn(reorderCategories);
  const storeFn = useServerFn(getMyStore);
  const qc = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => list() });
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: () => productsFn() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Category[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("physical");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (categories) setItems(categories);
  }, [categories]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products ?? []) {
      const cid = (p as any).category_id as string | null;
      if (!cid) continue;
      m.set(cid, (m.get(cid) ?? 0) + 1);
    }
    return m;
  }, [products]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      if (!matchesTab(c, tab)) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, tab, q]);

  function startNew() {
    setEditing(null);
    setOpen(true);
  }
  function startEdit(c: Category) {
    setEditing(c);
    setOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Products will be uncategorised.")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    toast.success("Deleted");
  }

  async function toggleActive(c: Category) {
    await save({ data: { id: c.id, name: c.name, is_active: !c.is_active } });
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
  }

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const from = items.findIndex((x) => x.id === dragId);
    const to = items.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  }
  async function onDragEnd() {
    setDragId(null);
    if (!items.length) return;
    try {
      await reorder({ data: { ids: items.map((x) => x.id) } });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const activeType: string = tab === "all" ? "physical" : tab;

  const addBtn = (
    <Button onClick={startNew}>
      <Plus className="mr-1 h-4 w-4" />
      Add category
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Categories"
        description="Drag to reorder. Toggle visibility with the eye icon."
        action={addBtn}
      />

      <TypeFilterTabs tabs={TABS} value={tab} onChange={setTab} />

      <AdminToolbar
        value={q}
        onChange={setQ}
        placeholder="Search categories…"
        action={addBtn}
      />


      <div key={tab} className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-hidden rounded-xl border bg-card duration-200">
        {visible.length === 0 ? (
          <div className="space-y-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">No categories found.</p>
            <Button onClick={startNew} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add category
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {(() => {
              const mains = visible.filter((c) => !(c as any).parent_id);
              const subsByParent = new Map<string, Category[]>();
              for (const c of visible) {
                const pid = (c as any).parent_id as string | null;
                if (pid) {
                  if (!subsByParent.has(pid)) subsByParent.set(pid, []);
                  subsByParent.get(pid)!.push(c);
                }
              }
              const orphans = visible.filter(
                (c) =>
                  (c as any).parent_id &&
                  !mains.some((m) => m.id === (c as any).parent_id),
              );
              const ordered: Array<{ c: Category; indent: boolean }> = [];
              for (const m of mains) {
                ordered.push({ c: m, indent: false });
                for (const s of subsByParent.get(m.id) ?? []) {
                  ordered.push({ c: s, indent: true });
                }
              }
              for (const o of orphans) ordered.push({ c: o, indent: true });
              return ordered.map(({ c, indent }) => {
                const src = c.image_url
                  ? c.image_url.startsWith("http")
                    ? c.image_url
                    : `/api/img/${c.image_url}`
                  : null;
                const parent = items.find((x) => x.id === (c as any).parent_id);
                return (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={() => onDragStart(c.id)}
                    onDragOver={(e) => onDragOver(e, c.id)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-3 p-3 ${indent ? "pl-10" : ""} ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      {src ? (
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-1 text-sm font-medium">
                          {indent && <span className="text-muted-foreground">↳ </span>}
                          {c.name}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {counts.get(c.id) ?? 0} products
                        </span>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {parent ? `In ${parent.name}` : "Main category"}
                        {c.description ? ` · ${c.description}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleActive(c)}
                      className="rounded p-2 hover:bg-muted"
                      aria-label={c.is_active ? "Hide" : "Show"}
                      title={c.is_active ? "Active — click to hide" : "Hidden — click to show"}
                    >
                      {c.is_active ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded p-2 hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded p-2 text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              });
            })()}
          </ul>
        )}
      </div>


      {open && store && (
        <CategoryDialog
          storeId={store.id}
          editing={editing}
          nextOrder={items.length}
          allCategories={items.filter((c) => typeOf(c) === (editing ? typeOf(editing) : activeType))}
          productType={editing ? typeOf(editing) : activeType}
          onClose={() => setOpen(false)}
          onSave={async (data) => {
            await save({ data });
            qc.invalidateQueries({ queryKey: ["admin", "categories"] });
            toast.success("Saved");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  storeId,
  editing,
  nextOrder,
  allCategories,
  productType,
  onClose,
  onSave,
}: {
  storeId: string;
  editing: Category | null;
  nextOrder: number;
  allCategories: Category[];
  productType: string;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [image, setImage] = useState<string | null>(editing?.image_url ?? null);
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? nextOrder);
  const [isActive, setIsActive] = useState<boolean>(editing?.is_active ?? true);
  const [parentId, setParentId] = useState<string | null>((editing as any)?.parent_id ?? null);
  const [saving, setSaving] = useState(false);

  const parentOptions = allCategories.filter(
    (c) => !(c as any).parent_id && (!editing || c.id !== editing.id),
  );

  const typeLabel = TABS.find((t) => t.key === productType)?.label ?? "Physical";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        name: name.trim(),
        image_url: image,
        description: description.trim() || null,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
        parent_id: parentId,
        ...(editing ? {} : { product_type: productType }),
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
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">Product type: {typeLabel}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category image</Label>
            <ImageUploader storeId={storeId} value={image} onChange={setImage} />
            <p className="text-xs text-muted-foreground">
              JPG, PNG or WEBP. Recommended 512×512 (square). Max 2 MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n">Name</Label>
            <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pid">Parent category</Label>
            <select
              id="pid"
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— None (main category)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Leave empty to make this a main category. Selecting a parent makes this a subcategory.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d">Description</Label>
            <Textarea
              id="d"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="so">Display order</Label>
              <Input
                id="so"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia">Status</Label>
              <select
                id="ia"
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
