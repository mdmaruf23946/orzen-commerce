import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyStore, updateProductDefaults } from "@/lib/admin.functions";
import {
  PRODUCT_TYPE_KEYS,
  PRODUCT_TYPE_LABELS,
  normalizeProductDefaults,
  supportsWarranty,
  type ProductDefaults,
  type ProductTypeKey,
} from "@/lib/product-defaults";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/product-defaults")({
  component: ProductDefaultsPage,
});

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const selectCls =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function ProductDefaultsPage() {
  const fetchStore = useServerFn(getMyStore);
  const save = useServerFn(updateProductDefaults);
  const qc = useQueryClient();

  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });

  const initial = useMemo<ProductDefaults | null>(
    () => (store ? normalizeProductDefaults((store as any).product_defaults) : null),
    [store],
  );

  const [form, setForm] = useState<ProductDefaults | null>(null);
  const [type, setType] = useState<ProductTypeKey>("physical");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial && !form) setForm(initial);
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const d = form.per_type[type];
  function set<K extends keyof typeof d>(k: K, v: (typeof d)[K]) {
    setForm((f) =>
      f ? { per_type: { ...f.per_type, [type]: { ...f.per_type[type], [k]: v } } } : f,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: form });
      await qc.invalidateQueries({ queryKey: ["admin", "store"] });
      const next = await qc.fetchQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
      if (next) setForm(normalizeProductDefaults((next as any).product_defaults));
      toast.success("Product defaults saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Product Defaults</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Applied automatically when you create a new product. Every product can still be edited
          individually afterwards. Shipping information comes from the Delivery &amp; Shipping
          module — it is not configured here.
        </p>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PRODUCT_TYPE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition sm:text-sm",
              type === k
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {PRODUCT_TYPE_LABELS[k]}
          </button>
        ))}
      </div>

      {supportsWarranty(type) && (
        <>
          <Card
            title="Default Warranty"
            hint="Prefilled into every new physical product. e.g. No Warranty, 7 Days Warranty, 30 Days Replacement Warranty."
          >
            <Textarea
              rows={3}
              value={d.warranty ?? ""}
              onChange={(e) => set("warranty", e.target.value)}
              placeholder="7 Days Replacement Warranty"
            />
          </Card>

          <Card
            title="Default Return Policy"
            hint="Global return / exchange text prefilled into every new physical product."
          >
            <Textarea
              rows={4}
              value={d.return_policy ?? ""}
              onChange={(e) => set("return_policy", e.target.value)}
              placeholder="Returns accepted within 7 days of delivery in original condition."
            />
          </Card>
        </>
      )}

      <Card
        title="Default Description Footer"
        hint="Appended to the description of every new product. Can be edited or removed per product."
      >
        <Textarea
          rows={4}
          value={d.footer}
          onChange={(e) => set("footer", e.target.value)}
          placeholder={"Original Product\nCash on Delivery Available\nFast Delivery\nContact Support if Needed"}
        />
      </Card>

      <Card
        title="Default Product Tags"
        hint="Comma separated SEO / search keywords added to new products. Editable per product."
      >
        <Input
          value={d.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="ORZEN, Bangladesh, Online Shopping"
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Default Visibility" hint="Where a newly created product appears.">
          <select
            className={selectCls}
            value={d.visibility}
            onChange={(e) => set("visibility", e.target.value as any)}
          >
            <option value="public">Public</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
        </Card>

        <Card title="Default Status" hint="Status assigned right after creation.">
          <select
            className={selectCls}
            value={d.status}
            onChange={(e) => set("status", e.target.value as any)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Card>
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-xs text-muted-foreground">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button type="submit" disabled={saving || !dirty} className="w-full sm:w-auto sm:min-w-40">
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
