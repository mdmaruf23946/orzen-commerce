// Panels for one connected website: its own categories, products (with stock), orders and status sync.
// This data is isolated from the store's own catalog.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, FolderTree, ImageOff, Package, RefreshCw, Search, Eye } from "lucide-react";
import { getExternalCatalog, listExternalSiteOrders, retryExternalSync } from "@/lib/external-sites.functions";
import { updateLandingPageConnection } from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/orders/OrderCard";

const tk = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-BD")}`;

function useCatalog(id: string) {
  const fn = useServerFn(getExternalCatalog);
  return useQuery({ queryKey: ["ext-site", id, "catalog"], queryFn: () => fn({ data: { id } }), refetchInterval: 30_000 });
}

function Img({ url }: { url?: string | null }) {
  const [err, setErr] = useState(false);
  if (!url || err) return <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>;
  return <img src={url} alt="" loading="lazy" onError={() => setErr(true)} className="h-14 w-14 shrink-0 rounded-lg border object-cover" />;
}

export function SiteSummary({ id, conn }: { id: string; conn: any }) {
  const { data } = useCatalog(id);
  const info = (conn.site_info ?? {}) as Record<string, string>;
  const products = data?.products ?? [];
  const stock = products.reduce((s: number, p: any) => s + (Number(p.stock) || 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Categories" value={data?.categories.length ?? 0} />
        <Box label="Products" value={products.length} />
        <Box label="Total stock" value={stock} />
        <Box label="Last catalog sync" value={conn.last_catalog_sync_at ? new Date(conn.last_catalog_sync_at).toLocaleString() : "Not yet"} />
      </div>
      {Object.values(info).some(Boolean) && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="mb-2 font-semibold">Website contact</div>
          <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
            {info.name && <div>Name: <span className="text-foreground">{info.name}</span></div>}
            {info.phone && <div>Phone: <span className="text-foreground">{info.phone}</span></div>}
            {info.email && <div>Email: <span className="text-foreground">{info.email}</span></div>}
            {info.address && <div>Address: <span className="text-foreground">{info.address}</span></div>}
            {info.website && <div>Website: <span className="text-foreground">{info.website}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoriesPanel({ id, onOpen }: { id: string; onOpen: (cat: string) => void }) {
  const { data, isLoading } = useCatalog(id);
  const counts = useMemo(() => {
    const m = new Map<string, { n: number; stock: number }>();
    for (const p of data?.products ?? []) {
      const k = p.category_external_id ?? "";
      const c = m.get(k) ?? { n: 0, stock: 0 };
      c.n++; c.stock += Number(p.stock) || 0; m.set(k, c);
    }
    return m;
  }, [data]);
  if (isLoading) return <Empty text="Loading…" />;
  const cats = data?.categories ?? [];
  if (!cats.length) return <Empty text="No categories yet. They appear here automatically after the website sends its catalog." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cats.map((c: any) => {
        const k = counts.get(c.external_id) ?? { n: 0, stock: 0 };
        return (
          <button key={c.external_id} onClick={() => onOpen(c.external_id)} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:border-primary">
            {c.image_url ? <Img url={c.image_url} /> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary/10"><FolderTree className="h-5 w-5 text-primary" /></div>}
            <div className="min-w-0">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{k.n} products · {k.stock} in stock</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ProductsPanel({ id, category, setCategory }: { id: string; category: string; setCategory: (c: string) => void }) {
  const { data, isLoading } = useCatalog(id);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const catName = useMemo(() => new Map((data?.categories ?? []).map((c: any) => [c.external_id, c.name])), [data]);
  const list = (data?.products ?? []).filter((p: any) =>
    (!category || p.category_external_id === category) &&
    (!q || `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  if (isLoading) return <Empty text="Loading…" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU" className="pl-8" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 text-sm">
          <option value="">All categories</option>
          {(data?.categories ?? []).map((c: any) => <option key={c.external_id} value={c.external_id}>{c.name}</option>)}
        </select>
      </div>
      {!list.length ? <Empty text="No products yet. They appear here automatically after the website sends its catalog." /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((p: any) => {
            const out = p.stock != null && Number(p.stock) <= 0;
            return (
              <li key={p.id} className="p-3">
                <div className="flex items-center gap-3">
                  <Img url={p.image_url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {catName.get(p.category_external_id) ?? "Uncategorised"}{p.sku ? ` · SKU ${p.sku}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{tk(p.sale_price ?? p.price)}</div>
                    {p.sale_price != null && <div className="text-xs text-muted-foreground line-through">{tk(p.price)}</div>}
                  </div>
                  <span className={`w-24 rounded-md px-2 py-1 text-center text-[11px] font-semibold ${out ? "bg-destructive/10 text-destructive" : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"}`}>
                    {p.stock == null ? "Stock —" : out ? "Out of stock" : `${p.stock} in stock`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Hide" : "Details"}</Button>
                </div>
                {open === p.id && (
                  <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                    {p.description ? <p className="whitespace-pre-line text-muted-foreground">{p.description}</p> : <p className="text-muted-foreground">No description.</p>}
                    {Array.isArray(p.variants) && p.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.variants.map((v: any, i: number) => (
                          <span key={i} className="rounded-md border bg-background px-2 py-1 text-xs">
                            {v.name ?? v.label ?? Object.values(v).filter((x) => typeof x === "string").join(" / ")}
                            {v.stock != null ? ` · ${v.stock} pcs` : ""}{v.price != null ? ` · ${tk(v.price)}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.product_url && <a href={p.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">Open on website <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function OrdersPanel({ id }: { id: string }) {
  const fn = useServerFn(listExternalSiteOrders);
  const retry = useServerFn(retryExternalSync);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ext-site", id, "orders"], queryFn: () => fn({ data: { id } }), refetchInterval: 20_000 });
  const syncByOrder = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of data?.sync ?? []) if (!m.has(s.order_id)) m.set(s.order_id, s);
    return m;
  }, [data]);
  if (isLoading) return <Empty text="Loading…" />;
  const orders = data?.orders ?? [];
  const pending = (data?.sync ?? []).some((s: any) => s.status === "queued" || s.status === "failed");
  return (
    <div className="space-y-3">
      {pending && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          Some status updates have not reached the website yet.
          <Button size="sm" variant="outline" onClick={async () => {
            const r = await retry({ data: { id } });
            toast.success(`Sent ${r.sent}, failed ${r.failed}`);
            qc.invalidateQueries({ queryKey: ["ext-site", id, "orders"] });
          }}><RefreshCw className="mr-1 h-3 w-3" /> Send again</Button>
        </div>
      )}
      {!orders.length ? <Empty text="No orders from this website yet." /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {orders.map((o: any) => {
            const s = syncByOrder.get(o.id);
            const items = (o.order_items ?? []) as any[];
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10"><Package className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">#{o.invoice_no ?? o.id.slice(0, 8)} · {o.customer_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.phone} · {items.map((i) => `${i.name_snapshot} ×${i.qty}`).join(", ")}</div>
                </div>
                <div className="font-semibold">{tk(o.subtotal)}</div>
                <StatusBadge status={o.status} />
                {s && (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${s.status === "sent" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : s.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-amber-500/12 text-amber-700 dark:text-amber-400"}`} title={s.last_error ?? ""}>
                    {s.status === "sent" ? "Synced to website" : s.status === "failed" ? "Sync failed" : "Syncing…"}
                  </span>
                )}
                <Link to="/admin/orders/$orderId" params={{ orderId: o.id }}><Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" /> View</Button></Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SyncSettingsCard({ id, conn }: { id: string; conn: any }) {
  const upd = useServerFn(updateLandingPageConnection);
  const qc = useQueryClient();
  const [url, setUrl] = useState<string>(conn.outbound_webhook_url ?? "");
  const [type, setType] = useState<string>(conn.site_type ?? "landing_page");
  async function save() {
    try {
      await upd({ data: { id, outbound_webhook_url: url.trim() || null, site_type: type as any } });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["landing-page", id] });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold">Website type & status sync</div>
      <div>
        <Label className="text-xs">This connection is a</Label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="landing_page">Landing page (one or few products)</option>
          <option value="website">E-commerce website (many categories & products)</option>
        </select>
      </div>
      <div>
        <Label className="text-xs">Status update link on your website (optional)</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourshop.com/orzen-status" className="mt-1 font-mono text-xs" />
        <p className="mt-1 text-xs text-muted-foreground">When you change an order's status, payment or courier here, we instantly send the update to this link (signed with your webhook secret).</p>
      </div>
      <Button size="sm" onClick={save}>Save</Button>
    </div>
  );
}

export function CatalogDocs({ base, id }: { base: string; id: string }) {
  const catalogUrl = `${base}/api/public/external-sites/${id}/catalog`;
  return (
    <>
      <div className="rounded-xl border bg-card p-4">
        <div className="font-semibold">Catalog sync (categories, products, stock, contact)</div>
        <p className="mt-2 text-xs text-muted-foreground">POST to <code className="font-mono">{catalogUrl}</code> with header <code className="font-mono">X-Api-Key: &lt;API_KEY&gt;</code> (or the same X-Signature/X-Timestamp as the webhook). Send again whenever a product, price or stock changes. Up to 5,000 products per request.</p>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{`{
  "contact": { "name": "My Shop", "phone": "01…", "email": "…", "address": "…", "website": "https://…" },
  "categories": [{ "external_id": "c1", "name": "Honey", "parent_external_id": null, "image_url": "https://…" }],
  "products": [{
    "external_id": "p1", "name": "Sundarban Honey 1kg", "sku": "HNY-1",
    "price": 1200, "sale_price": 990, "stock": 25,
    "description": "…", "image_url": "https://…", "product_url": "https://…",
    "category_external_id": "c1",
    "variants": [{ "name": "500g", "price": 550, "stock": 10 }]
  }],
  "deleted_product_ids": [],
  "replace": false      // true = this is the full catalog; anything missing is removed
}`}</pre>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="font-semibold">Orders with several products</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{`{
  "customer_name": "…", "phone": "…", "address": "…",
  "external_order_id": "WEB-1001",
  "items": [{ "external_product_id": "p1", "qty": 2, "variant": "500g" }],
  "delivery_charge": 60, "discount": 0, "payment_method": "cod"
}`}</pre>
        <p className="mt-2 text-xs text-muted-foreground">Prices are taken from your synced catalog. With the webhook or API key method you may also send "name" and "price" per item.</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="font-semibold">Status updates we send to your website</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{`POST <your status update link>
X-Orzen-Event: order.status_changed | order.updated
X-Timestamp: <unix seconds>
X-Signature: sha256=<HMAC-SHA256 of raw body with your webhook secret>

{ "event": "order.status_changed",
  "data": { "order_id": "…", "invoice_no": "…", "external_order_id": "WEB-1001",
            "status": "confirmed", "previous_status": "pending", "payment_status": "unpaid",
            "courier_name": "Steadfast", "courier_status": "…", "tracking_id": "…" } }`}</pre>
        <p className="mt-2 text-xs text-muted-foreground">Reply with any 2xx code. Failed deliveries are retried and can be re-sent from the Orders tab.</p>
      </div>
    </>
  );
}

function Box({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
