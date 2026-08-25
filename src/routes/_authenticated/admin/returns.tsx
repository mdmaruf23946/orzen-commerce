import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Package, Image as ImageIcon, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReturnPolicySection } from "@/components/admin/settings/ReturnPolicySection";
import { listReturnRequests } from "@/lib/returns-admin.functions";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { ReturnDrawer, img } from "@/components/admin/returns/ReturnDrawer";
import { ManualReturnWizard } from "@/components/admin/returns/ManualReturnWizard";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/returns-pricing";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  head: () => ({
    meta: [
      { title: "Returns & Exchanges — ORZEN Merchant Panel" },
      { name: "description", content: "Handle customer return and exchange requests." },
      { property: "og:title", content: "Returns & Exchanges — ORZEN Merchant Panel" },
      { property: "og:description", content: "Handle customer return and exchange requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="returns">
      <ReturnsPage />
    </FeatureGate>
  ),
});

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "transit", label: "In transit" },
  { key: "received", label: "Received" },
  { key: "inspection", label: "Inspection" },
  { key: "settlement", label: "Refund / Replacement" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  shipment_created: "bg-blue-100 text-blue-700",
  in_transit: "bg-indigo-100 text-indigo-700",
  received: "bg-violet-100 text-violet-700",
  inspection_passed: "bg-teal-100 text-teal-700",
  inspection_failed: "bg-red-100 text-red-700",
  replacement_created: "bg-emerald-100 text-emerald-700",
  refunded: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

function matches(tab: TabKey, status: string) {
  switch (tab) {
    case "all":
      return true;
    case "pending":
      return status === "requested";
    case "approved":
      return status === "approved" || status === "shipment_created";
    case "transit":
      return status === "in_transit";
    case "received":
      return status === "received";
    case "inspection":
      return status === "inspection_passed" || status === "inspection_failed";
    case "settlement":
      return status === "refunded" || status === "replacement_created";
    case "completed":
      return status === "completed";
    case "closed":
      return status === "rejected" || status === "cancelled";
    default:
      return false;
  }
}

function ReturnsPage() {
  const list = useServerFn(listReturnRequests);
  const { data: rows } = useQuery({ queryKey: ["admin", "returns"], queryFn: () => list() });
  const [tab, setTab] = useState<TabKey>("pending");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const all = (rows as any[]) ?? [];
  const filtered = useMemo(() => all.filter((r) => matches(tab, r.status)), [all, tab]);
  const current = activeId ? (all.find((r) => r.id === activeId) ?? null) : null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Returns & Exchanges"
        description="Every request moves through approval, return shipment, inspection, then refund or replacement."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create return / exchange
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:hidden">
        <Button size="sm" className="w-full" onClick={() => setManualOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create return / exchange
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="mr-2 h-4 w-4" /> Return &amp; Exchange settings
        </Button>
      </div>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle>Return &amp; Exchange settings</SheetTitle>
          </SheetHeader>
          <ReturnPolicySection />
        </SheetContent>
      </Sheet>


      <TypeFilterTabs
        tabs={TABS.map((t) => ({
          ...t,
          label: `${t.label} (${all.filter((r) => matches(t.key, r.status)).length})`,
        }))}
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No requests here yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const lines = (r.lines as any[]) ?? [];
            const extra = Number(r.extra_payment_due ?? 0);
            const refund = Number(r.refund_amount ?? 0);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className="rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.orders?.invoice_no ?? r.order_id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="truncate text-sm font-medium">
                      {r.customer_name ?? r.orders?.customer_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.phone ?? r.orders?.phone}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  {lines.slice(0, 4).map((it: any, i: number) => (
                    <span
                      key={i}
                      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted"
                    >
                      {img(it.image) ? (
                        <img src={img(it.image)!} alt={it.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                  <span className="ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {lines.map((i: any) => `${i.name} ×${i.qty}`).join(", ")}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-0.5">
                    {KIND_LABEL[(r.request_kind ?? "return") as keyof typeof KIND_LABEL] ?? r.request_kind}
                  </span>
                  {(r.images ?? []).length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> {(r.images as string[]).length}
                    </span>
                  )}
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  {extra > 0 ? (
                    <span className="font-medium text-foreground">Customer pays ৳{extra.toFixed(0)}</span>
                  ) : refund > 0 ? (
                    <span className="font-medium text-foreground">Refund ৳{refund.toFixed(0)}</span>
                  ) : null}
                </div>

                {r.reason && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.reason}</p>}
              </button>
            );
          })}
        </div>
      )}

      {manualOpen && <ManualReturnWizard onClose={() => setManualOpen(false)} />}

      {current && (
        <ReturnDrawer key={current.id} request={current} onClose={() => setActiveId(null)} />
      )}
    </div>
  );
}
