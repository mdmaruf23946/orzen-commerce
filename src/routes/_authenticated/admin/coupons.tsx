import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { listCoupons, upsertCoupon, deleteCoupon } from "@/lib/business.functions";
import { listMyCategories, listMyProducts } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { useProductTypeScope } from "@/lib/product-type-scope";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({
    meta: [
      { title: "Coupons — ORZEN Merchant Panel" },
      { name: "description", content: "Create and manage discount coupons for your store." },
      { property: "og:title", content: "Coupons — ORZEN Merchant Panel" },
      { property: "og:description", content: "Create and manage discount coupons for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <FeatureGate feature="coupons"><CouponsPage /></FeatureGate>,
});

const TABS = [
  { key: "all", label: "All" },
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
  { key: "subscription", label: "Subscription" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

function typeOf(c: any): string {
  const t = (c?.product_type ?? "").toString().trim().toLowerCase();
  return t || "physical";
}

function typeLabel(t: string) {
  return TABS.find((x) => x.key === t)?.label ?? "Physical";
}

function isExpired(c: any) {
  return !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
}

function fmtDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CouponsPage() {
  const list = useServerFn(listCoupons);
  const save = useServerFn(upsertCoupon);
  const del = useServerFn(deleteCoupon);
  const catsFn = useServerFn(listMyCategories);
  const prodsFn = useServerFn(listMyProducts);
  const qc = useQueryClient();
  const { scope, setScope, filter, activeType: scopeType } = useProductTypeScope();
  const { data: coupons } = useQuery({
    queryKey: ["coupons", filter ?? "all"],
    queryFn: () => list({ data: { product_type: filter } } as any),
  });
  const { data: categories } = useQuery({
    queryKey: ["admin", "categories", filter ?? "all"],
    queryFn: () => catsFn({ data: { product_type: filter } } as any),
  });
  const { data: products } = useQuery({
    queryKey: ["admin", "products", filter ?? "all"],
    queryFn: () => prodsFn({ data: { product_type: filter } } as any),
  });
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const tab = scope as TabKey;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const activeType: string = scopeType;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = ((coupons ?? []) as any[]).filter((c) => {
      if (tab !== "all" && typeOf(c) !== tab) return false;
      if (!needle) return true;
      return (
        ((c.name ?? "") as string).toLowerCase().includes(needle) ||
        ((c.code ?? "") as string).toLowerCase().includes(needle)
      );
    });
    if (sort === "active") rows = rows.filter((c) => c.active && !isExpired(c));
    if (sort === "expired") rows = rows.filter((c) => isExpired(c));
    rows = rows.slice().sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return rows;
  }, [coupons, tab, q, sort]);

  function startNew() {
    setEdit(null);
    setOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["coupons"] });
    toast.success("Deleted");
  }

  const addBtn = (
    <Button onClick={startNew}>
      <Plus className="mr-1 h-4 w-4" />
      New coupon
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Coupons"
        description="Discount and promo codes for your store."
        action={addBtn}
      />

      <TypeFilterTabs tabs={TABS} value={tab} onChange={(k) => setScope(k)} />

      <AdminToolbar
        value={q}
        onChange={setQ}
        placeholder="Search coupons…"
        action={addBtn}
        trailing={
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-40"
            aria-label="Sort coupons"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        }
      />


      <div key={tab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
        {visible.length === 0 ? (
          <div className="space-y-3 rounded-xl border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No coupons found.</p>
            <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" />New coupon</Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Code</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Used</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c: any) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-medium">{c.name || "—"}</td>
                      <td className="p-3 font-mono">{c.code}</td>
                      <td className="p-3 text-right">
                        {c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `৳${c.value}` : "Free shipping"}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {typeLabel(typeOf(c))}
                        </span>
                      </td>
                      <td className="p-3 text-right">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                      <td className="p-3 text-xs">{fmtDate(c.expires_at)}</td>
                      <td className="p-3">
                        <StatusBadge c={c} />
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => { setEdit(c); setOpen(true); }} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(c.id)} className="ml-1 rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {visible.map((c: any) => (
                <div key={c.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name || c.code}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                    </div>
                    <StatusBadge c={c} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2 py-0.5">{typeLabel(typeOf(c))}</span>
                    <span>{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `৳${c.value}` : "Free shipping"}</span>
                    <span>Used {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</span>
                    <span>Expires {fmtDate(c.expires_at)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEdit(c); setOpen(true); }}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {open && (
        <CouponDialog
          editing={edit}
          productType={edit ? typeOf(edit) : activeType}
          categories={(categories ?? []) as any[]}
          products={(products ?? []) as any[]}
          onClose={() => setOpen(false)}
          onSave={async (d) => {
            await save({ data: d });
            qc.invalidateQueries({ queryKey: ["coupons"] });
            toast.success("Saved");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ c }: { c: any }) {
  const expired = isExpired(c);
  const label = expired ? "Expired" : c.active ? "Active" : "Inactive";
  return (
    <span
      className={cn(
        "shrink-0 rounded px-2 py-0.5 text-xs",
        expired
          ? "bg-amber-100 text-amber-800"
          : c.active
            ? "bg-emerald-100 text-emerald-800"
            : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function CouponDialog({
  editing,
  productType,
  categories,
  products,
  onClose,
  onSave,
}: {
  editing: any;
  productType: string;
  categories: any[];
  products: any[];
  onClose: () => void;
  onSave: (d: any) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [type, setType] = useState<"percent" | "fixed" | "free_shipping">(editing?.type ?? "percent");
  const [value, setValue] = useState<number>(editing?.value ?? 10);
  const [minOrder, setMinOrder] = useState<number>(editing?.min_order ?? 0);
  const [maxDiscount, setMaxDiscount] = useState<string>(editing?.max_discount ? String(editing.max_discount) : "");
  const [usageLimit, setUsageLimit] = useState<string>(editing?.usage_limit ? String(editing.usage_limit) : "");
  const [perCustomer, setPerCustomer] = useState<string>(editing?.per_customer_limit ? String(editing.per_customer_limit) : "");
  const [starts, setStarts] = useState<string>(editing?.starts_at ? String(editing.starts_at).slice(0, 10) : "");
  const [expires, setExpires] = useState<string>(editing?.expires_at ? String(editing.expires_at).slice(0, 10) : "");
  const [catIds, setCatIds] = useState<string[]>(editing?.category_ids ?? []);
  const [prodIds, setProdIds] = useState<string[]>(editing?.product_ids ?? []);
  const [active, setActive] = useState<boolean>(editing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const scopedCategories = useMemo(
    () => categories.filter((c) => ((c.product_type ?? "physical") as string) === productType),
    [categories, productType],
  );

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        name: name.trim() || null,
        code: code.trim(),
        product_type: productType,
        type,
        value: type === "free_shipping" ? 0 : Number(value),
        min_order: Number(minOrder),
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        per_customer_limit: perCustomer ? Number(perCustomer) : null,
        starts_at: starts || null,
        expires_at: expires || null,
        category_ids: catIds,
        product_ids: prodIds,
        active,
      });
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit coupon" : "New coupon"}
            <span className="ml-2 rounded-full border px-2 py-0.5 align-middle text-xs font-normal text-muted-foreground">
              {typeLabel(productType)}
            </span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Coupon name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome offer" />
          </div>
          <div className="space-y-1.5">
            <Label>Coupon code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required placeholder="WELCOME10" />
          </div>
          <div className="space-y-1.5">
            <Label>Discount type</Label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="percent">Percentage discount</option>
              <option value="fixed">Fixed amount discount</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </div>
          {type !== "free_shipping" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{type === "percent" ? "Percent (%)" : "Amount (৳)"}</Label>
                <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max discount (৳)</Label>
                <Input type="number" min={0} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="No cap" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min order (৳)</Label>
              <Input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Usage limit</Label>
              <Input type="number" min={0} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Limit per customer</Label>
              <Input type="number" min={0} value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} placeholder="Unlimited" />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Applicable categories (optional)</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
              {scopedCategories.length === 0 && <p className="text-xs text-muted-foreground">No categories.</p>}
              {scopedCategories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={catIds.includes(c.id)} onChange={() => toggle(catIds, setCatIds, c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Applicable products (optional)</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
              {products.length === 0 && <p className="text-xs text-muted-foreground">No products.</p>}
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={prodIds.includes(p.id)} onChange={() => toggle(prodIds, setProdIds, p.id)} />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save coupon"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
