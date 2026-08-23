import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Search, ImageIcon } from "lucide-react";
import {
  listMyBanners,
  listMyCategories,
  addBanner,
  updateBanner,
  deleteBanner,
  getMyStore,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { useProductTypeScope } from "@/lib/product-type-scope";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({
    meta: [
      { title: "Banners — ORZEN Store Admin" },
      { name: "description", content: "Manage storefront banners and promotional slides." },
      { property: "og:title", content: "Banners — ORZEN Store Admin" },
      { property: "og:description", content: "Manage storefront banners and promotional slides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BannersPage,
});

type Banner = Awaited<ReturnType<typeof listMyBanners>>[number];
type Category = Awaited<ReturnType<typeof listMyCategories>>[number];

const TABS = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const POSITIONS = [
  { value: "hero", label: "Hero Banner" },
  { value: "secondary", label: "Secondary Banner" },
  { value: "promotional", label: "Promotional Banner" },
  { value: "category", label: "Category Banner" },
] as const;

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

function typeOf(b: Banner): string {
  const t = ((b as any).product_type ?? "").toString().trim().toLowerCase();
  if (!t || t === "both" || t === "general") return "physical";
  return t;
}

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function BannersPage() {
  const list = useServerFn(listMyBanners);
  const cats = useServerFn(listMyCategories);
  const add = useServerFn(addBanner);
  const upd = useServerFn(updateBanner);
  const del = useServerFn(deleteBanner);
  const storeFn = useServerFn(getMyStore);
  const qc = useQueryClient();
  const { scope, setScope, filter, activeType: scopeType } = useProductTypeScope();
  const { data: banners } = useQuery({
    queryKey: ["admin", "banners", filter ?? "all"],
    queryFn: () => list({ data: { product_type: filter } } as any),
  });
  const { data: categories } = useQuery({
    queryKey: ["admin", "categories", filter ?? "all"],
    queryFn: () => cats({ data: { product_type: filter } } as any),
  });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const tab = scope as TabKey;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const activeType: string = scopeType;

  const typeCount = useMemo(
    () => (banners ?? []).filter((b) => typeOf(b) === activeType).length,
    [banners, activeType],
  );
  const full = tab !== "all" && typeCount >= 3;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (banners ?? []).filter((b) => {
      if (tab !== "all" && typeOf(b) !== tab) return false;
      if (!needle) return true;
      return (
        (((b as any).title ?? "") as string).toLowerCase().includes(needle) ||
        ((b.link ?? "") as string).toLowerCase().includes(needle)
      );
    });
    if (sort === "active") rows = rows.filter((b) => (b as any).is_active !== false);
    if (sort === "inactive") rows = rows.filter((b) => (b as any).is_active === false);
    if (sort === "newest" || sort === "oldest") {
      rows = rows.slice().sort((a, b) => {
        const ta = new Date((a as any).created_at ?? 0).getTime();
        const tb = new Date((b as any).created_at ?? 0).getTime();
        return sort === "newest" ? tb - ta : ta - tb;
      });
    }
    return rows;
  }, [banners, tab, q, sort]);

  const catName = (id: string | null | undefined) =>
    id ? ((categories ?? []) as Category[]).find((c) => c.id === id)?.name ?? null : null;

  function startNew() {
    setEditing(null);
    setOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete banner?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    toast.success("Deleted");
  }

  const addBtn = (
    <Button onClick={startNew} disabled={full}>
      <Plus className="mr-1 h-4 w-4" /> Add banner
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Banners"
        description="Up to 3 banners per product type."
        action={addBtn}
      />

      <TypeFilterTabs tabs={TABS} value={tab} onChange={(k) => setScope(k)} />

      <AdminToolbar
        value={q}
        onChange={setQ}
        placeholder="Search banners…"
        action={addBtn}
        trailing={
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-40"
            aria-label="Sort banners"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        }
      />

      {full && (
        <p className="text-xs text-muted-foreground">
          You have reached the limit of 3 banners for this product type.
        </p>
      )}


      <div key={tab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
        {visible.length === 0 ? (
          <div className="space-y-3 rounded-xl border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No banners found.</p>
            <Button onClick={startNew} size="sm" disabled={full}>
              <Plus className="mr-1 h-4 w-4" /> Add banner
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => {
              const title = ((b as any).title as string) || "Untitled banner";
              const pos = POSITIONS.find((p) => p.value === (b as any).display_position)?.label ?? "Hero Banner";
              const cname = catName((b as any).category_id);
              const isActive = (b as any).is_active !== false;
              return (
                <div key={b.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="grid aspect-[16/7] place-items-center bg-muted">
                    {b.image_url ? (
                      <img src={imgSrc(b.image_url)} alt={title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium">{title}</p>
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
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{pos}</span>
                      {cname && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {cname}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Order {(b as any).sort_order ?? 0}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{b.link || "No link"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Updated {fmtDate((b as any).updated_at ?? (b as any).created_at)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditing(b);
                            setOpen(true);
                          }}
                          className="rounded p-2 hover:bg-muted"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(b.id)}
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
      </div>

      {open && store && (
        <BannerDialog
          storeId={store.id}
          editing={editing}
          productType={editing ? typeOf(editing) : activeType}
          categories={((categories ?? []) as Category[]).filter(
            (c) => ((c as any).product_type ?? "physical") === (editing ? typeOf(editing) : activeType),
          )}
          nextOrder={typeCount + 1}
          onClose={() => setOpen(false)}
          onSave={async (data) => {
            if (editing) await upd({ data: { id: editing.id, ...data } });
            else await add({ data });
            qc.invalidateQueries({ queryKey: ["admin", "banners"] });
            toast.success("Saved");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BannerDialog({
  storeId,
  editing,
  productType,
  categories,
  nextOrder,
  onClose,
  onSave,
}: {
  storeId: string;
  editing: Banner | null;
  productType: string;
  categories: Category[];
  nextOrder: number;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [title, setTitle] = useState<string>(((editing as any)?.title as string) ?? "");
  const [image, setImage] = useState<string | null>(editing?.image_url ?? null);
  const [link, setLink] = useState(editing?.link ?? "");
  const [position, setPosition] = useState<string>(((editing as any)?.display_position as string) ?? "hero");
  const [categoryId, setCategoryId] = useState<string | null>(((editing as any)?.category_id as string) ?? null);
  const [sortOrder, setSortOrder] = useState<number>(((editing as any)?.sort_order as number) ?? nextOrder);
  const [isActive, setIsActive] = useState<boolean>(((editing as any)?.is_active as boolean) ?? true);
  const [saving, setSaving] = useState(false);

  const typeLabel = TABS.find((t) => t.key === productType)?.label ?? "Physical";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    if (!image) return toast.error("Upload an image");
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        image_url: image,
        link: link.trim() || null,
        display_position: position,
        category_id: categoryId,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
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
          <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">Product type: {typeLabel}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bt">Banner title</Label>
            <Input id="bt" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Banner image</Label>
            <ImageUploader storeId={storeId} value={image} onChange={setImage} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lnk">Link (optional)</Label>
            <Input id="lnk" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/product/..." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos">Display position</Label>
            <select
              id="pos"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat">Related category (optional)</Label>
            <select
              id="cat"
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="so">Sort order</Label>
              <Input
                id="so"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st">Status</Label>
              <select
                id="st"
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
