import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Printer, RefreshCw, Send, Settings2, Truck, X } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ParcelDrawer,
  PickupTab,
  LogsTab,
  StatusPill,
  courierLabel,
  money,
  openPrintWindow,
} from "@/components/admin/couriers/parcel-ui";
import { SendToCourierDialog } from "@/components/admin/couriers/SendToCourierDialog";
import { ItemThumbs } from "@/components/admin/couriers/ItemThumbs";
import { type ParcelStatus } from "@/lib/couriers/status";
import { type CourierKey } from "@/components/admin/couriers/providers";
import {
  listParcels,
  parcelStatusCounts,
  listSendableOrders,
  getCourierOverview,
  refreshParcelStatus,
  syncActiveParcels,
  getParcelPrintData,
  getParcelLabel,
} from "@/lib/courier-parcels.functions";

export const Route = createFileRoute("/_authenticated/admin/courier-orders")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Courier Orders · ORZEN Merchant Panel" },
      {
        name: "description",
        content:
          "Send confirmed orders to your connected courier, track parcels, sync delivery status and print labels.",
      },
      { property: "og:title", content: "Courier Orders · ORZEN Merchant Panel" },
      {
        property: "og:description",
        content: "Central parcel operations for every connected courier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeatureGate feature="courier">
      <CourierOrdersPage />
    </FeatureGate>
  ),
});

type TabDef = {
  value: string;
  label: string;
  statuses?: ParcelStatus[];
  exclude?: ParcelStatus[];
};

const TABS: TabDef[] = [
  { value: "ready", label: "Ready to Send" },
  { value: "sent", label: "Sent Parcels", exclude: ["draft"] },
  {
    value: "processing",
    label: "Processing",
    statuses: ["pending", "pickup_requested", "pickup_completed", "in_transit"],
  },
  { value: "delivered", label: "Delivered", statuses: ["delivered"] },
  { value: "partial", label: "Partial Delivered", statuses: ["partial_delivered"] },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
  { value: "returned", label: "Returned", statuses: ["returned"] },
  { value: "failed", label: "Failed", statuses: ["failed", "draft"] },
  { value: "hold", label: "Hold", statuses: ["hold"] },
];

function CourierOrdersPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/courier-orders" });
  const active = TABS.find((t) => t.value === tab) ?? TABS[0];
  const qc = useQueryClient();

  const fetchOverview = useServerFn(getCourierOverview);
  const fetchList = useServerFn(listParcels);
  const fetchCounts = useServerFn(parcelStatusCounts);
  const fetchOrders = useServerFn(listSendableOrders);
  const refreshFn = useServerFn(refreshParcelStatus);
  const syncAllFn = useServerFn(syncActiveParcels);
  const printFn = useServerFn(getParcelPrintData);
  const labelFn = useServerFn(getParcelLabel);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendOrder, setSendOrder] = useState<any | null>(null);

  const { data: overview } = useQuery({
    queryKey: ["courier-overview"],
    queryFn: () => fetchOverview(),
  });
  const connected = (overview?.couriers ?? []) as any[];
  const defaultKey = (overview?.defaultKey ?? null) as CourierKey | null;

  const { data: counts } = useQuery({
    queryKey: ["parcel-counts"],
    queryFn: () => fetchCounts({ data: {} }),
  });

  const isReady = active.value === "ready";
  const filters = {
    statuses: active.statuses,
    excludeStatuses: active.exclude,
    search: search || undefined,
    limit: 50,
  };

  const { data: parcelData, isFetching } = useQuery({
    queryKey: ["parcels", active.value, search],
    queryFn: () => fetchList({ data: filters }),
    enabled: !isReady,
  });

  const { data: orders, isFetching: loadingOrders } = useQuery({
    queryKey: ["sendable-orders"],
    queryFn: () => fetchOrders({ data: { limit: 50 } }),
    enabled: isReady,
  });

  const rows = (parcelData?.rows ?? []) as any[];
  const orderRows = (orders ?? []) as any[];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["parcels"] });
    qc.invalidateQueries({ queryKey: ["parcel-counts"] });
    qc.invalidateQueries({ queryKey: ["sendable-orders"] });
  }

  function tabCount(t: TabDef) {
    if (t.value === "ready") return orderRows.length || undefined;
    const c = counts ?? {};
    const keys = t.statuses ?? Object.keys(c).filter((k) => !(t.exclude ?? []).includes(k as ParcelStatus));
    const n = keys.reduce((sum, k) => sum + (c[k] ?? 0), 0);
    return n || undefined;
  }

  const syncNow = useMutation({
    mutationFn: () => syncAllFn({ data: {} }),
    onSuccess: (r: any) => {
      toast.success(`Checked ${r.checked} parcel(s) · ${r.updated} updated`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkRefresh = useMutation({
    mutationFn: (ids: string[]) => refreshFn({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`Checked ${r.checked} · ${r.updated} updated`);
      setSelected([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Invoices always render with the store's selected invoice template. */
  function openTemplateInvoices(orderIds: string[]) {
    for (const id of orderIds) window.open(`/admin/invoice/${id}`, "_blank", "noopener");
  }

  async function print(ids: string[], kind: "invoice" | "label" | "packing") {
    if (!ids.length) return toast.error("Select at least one parcel");
    try {
      if (kind === "label") return await openLabels(ids);
      const d: any = await printFn({ data: { ids } });
      if (kind === "invoice") {
        const orderIds = (d?.parcels ?? []).map((p: any) => p.order_id).filter(Boolean);
        if (orderIds.length) return openTemplateInvoices(orderIds);
      }
      openPrintWindow(d, kind);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /**
   * Labels always come from the courier: the API label when the provider has
   * one, otherwise the courier's official merchant-panel label page. The
   * ORZEN-generated label is only used for couriers with no merchant system.
   */
  async function openLabels(ids: string[]) {
    const fallback: string[] = [];
    for (const id of ids) {
      try {
        const r: any = await labelFn({ data: { id } });
        if (r?.url) {
          window.open(r.url, "_blank", "noopener");
        } else {
          toast.message(r?.message ?? "Label unavailable");
          fallback.push(id);
        }
      } catch (e) {
        toast.error((e as Error).message);
        fallback.push(id);
      }
    }
    if (fallback.length) {
      const d: any = await printFn({ data: { ids: fallback } });
      openPrintWindow(d, "label");
    }
  }

  /** Ready-to-send orders have no parcel yet, so print straight from the order. */
  function printOrder(o: any, kind: "invoice" | "label") {
    if (kind === "invoice") return openTemplateInvoices([o.id]);
    openPrintWindow(
      {
        store: null,
        invoiceByOrder: { [o.id]: o.invoice_no ?? "" },
        parcels: [
          {
            id: o.id,
            order_id: o.id,
            courier_key: o.courier_key ?? defaultKey ?? "",
            recipient_name: o.customer_name,
            recipient_phone: o.phone,
            recipient_address: [o.address, o.area].filter(Boolean).join(", "),
            cod_amount: o.cod_amount ?? 0,
            items: o.items ?? [],
            tracking_code: null,
            note: null,
          },
        ],
      },
      kind,
    );
  }


  const allChecked = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">Courier Orders</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Send orders to your courier, track parcels and print documents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
            <RefreshCw className={`mr-1 h-4 w-4 ${syncNow.isPending ? "animate-spin" : ""}`} /> Sync Now
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/couriers">
              <Settings2 className="mr-1 h-4 w-4" /> Courier Integration
            </Link>
          </Button>
        </div>
      </div>

      {/* connected courier banner */}
      {connected.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No courier connected yet.</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/admin/couriers">Go to Courier Integration</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Current Courier:</span>
          {connected.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <span className="font-medium">{courierLabel(c.key)}</span>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                Connected
              </span>
              {c.isDefault && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  Default Courier
                </span>
              )}
              {c.sandbox && (
                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                  Test mode
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <Tabs
        value={active.value}
        onValueChange={(v) => {
          setSelected([]);
          navigate({ search: (prev: { tab?: string }) => ({ ...prev, tab: v }) });
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
              {t.label}
              {tabCount(t) ? ` (${tabCount(t)})` : ""}
            </TabsTrigger>
          ))}
          <TabsTrigger value="pickup">Pickup</TabsTrigger>
          <TabsTrigger value="logs">API Logs</TabsTrigger>
        </TabsList>

        {/* ---------------------------- ready ---------------------------- */}
        <TabsContent value="ready" className="space-y-3 pt-3">
          {loadingOrders && orderRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : orderRows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Send className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No confirmed orders waiting to be sent.</p>
            </div>
          ) : (
            orderRows.map((o) => (
              <div key={o.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {o.invoice_no ?? `#${String(o.id).slice(0, 8).toUpperCase()}`}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                    {o.payment_method} · {o.payment_status ?? "unpaid"}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {courierLabel(o.courier_key ?? defaultKey ?? "—")}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">{o.phone}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[o.address, o.area].filter(Boolean).join(", ")}
                </p>
                <div className="mt-2 flex items-start gap-2">
                  <ItemThumbs items={o.items as any} />
                  <p className="line-clamp-2 flex-1 pt-0.5 text-xs text-muted-foreground">
                    {(o.items ?? []).map((i: any) => `${i.name} × ${i.qty}`).join(", ") || "—"}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>COD: <strong>{money(o.cod_amount)}</strong></span>
                  <span>Delivery: {money(o.delivery_amount)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/orders" search={{ q: o.invoice_no ?? undefined } as never}>
                      View Details
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => setSendOrder(o)} disabled={connected.length === 0}>
                    <Send className="mr-1 h-3.5 w-3.5" /> Send to Courier
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printOrder(o, "invoice")}>
                    <Printer className="mr-1 h-3.5 w-3.5" /> Invoice
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printOrder(o, "label")}>
                    <Printer className="mr-1 h-3.5 w-3.5" /> Label
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* --------------------------- parcels --------------------------- */}
        {TABS.filter((t) => t.value !== "ready").map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-3 pt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking, name or phone"
              className="h-9 w-full sm:max-w-xs"
            />

            {selected.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2 text-sm">
                <span className="px-1 font-medium">{selected.length} selected</span>
                <Button size="sm" variant="outline" onClick={() => bulkRefresh.mutate(selected)} disabled={bulkRefresh.isPending}>
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${bulkRefresh.isPending ? "animate-spin" : ""}`} /> Sync Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => print(selected, "label")}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> Label
                </Button>
                <Button size="sm" variant="outline" onClick={() => print(selected, "invoice")}>
                  Invoice
                </Button>
                <Button size="sm" variant="outline" onClick={() => print(selected, "packing")}>
                  Packing slip
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {rows.length > 0 && (
              <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])}
                />
                Select all on this page
              </label>
            )}

            {isFetching && rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((p) => (
                  <div key={p.id} className="rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={selected.includes(p.id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                        }
                      />
                      <ItemThumbs items={(p as any).items} max={2} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(p.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{p.recipient_name}</span>
                          <StatusPill status={p.status} />
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {courierLabel(p.courier_key)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.recipient_phone} · {p.recipient_address}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          COD {money(p.cod_amount)}
                          {p.tracking_code ? ` · ${p.tracking_code}` : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Updated {new Date(p.last_synced_at ?? p.updated_at ?? p.created_at).toLocaleString()}
                        </p>
                        {p.last_error && (
                          <p className="mt-1 line-clamp-2 text-xs text-destructive">{p.last_error}</p>
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-7">
                      {p.tracking_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={p.tracking_url} target="_blank" rel="noreferrer">
                            Track <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => bulkRefresh.mutate([p.id])}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Sync Status
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => print([p.id], "label")}>
                        Label
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => print([p.id], "invoice")}>
                        Invoice
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(p.id)}>
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="pickup" className="pt-3">
          <PickupTab courier={defaultKey ?? undefined} />
        </TabsContent>
        <TabsContent value="logs" className="pt-3">
          <LogsTab />
        </TabsContent>
      </Tabs>

      <SendToCourierDialog
        order={sendOrder}
        couriers={connected}
        defaultKey={defaultKey}
        onOpenChange={(v) => !v && setSendOrder(null)}
        onSent={() => {
          setSendOrder(null);
          invalidate();
          navigate({ search: (prev: { tab?: string }) => ({ ...prev, tab: "sent" }) });
        }}
      />

      <ParcelDrawer id={openId} onClose={() => setOpenId(null)} onChanged={invalidate} onPrint={print} />
    </div>
  );
}
