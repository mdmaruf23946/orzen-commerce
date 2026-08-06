import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Package, Image as ImageIcon } from "lucide-react";
import { listReturns } from "@/lib/business.functions";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { ReturnDrawer } from "@/components/admin/returns/ReturnDrawer";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  component: () => (
    <FeatureGate feature="returns">
      <ReturnsPage />
    </FeatureGate>
  ),
});

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  refunded: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
};

function img(p?: string | null) {
  if (!p) return null;
  const raw = p.trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

function matches(tab: TabKey, status: string) {
  if (tab === "all") return true;
  if (tab === "pending") return status === "requested";
  if (tab === "completed") return status === "refunded" || status === "completed";
  return status === tab;
}

function ReturnsPage() {
  const list = useServerFn(listReturns);
  const { data: rows } = useQuery({ queryKey: ["returns"], queryFn: () => list() });
  const [tab, setTab] = useState<TabKey>("pending");
  const [active, setActive] = useState<any | null>(null);

  const all = (rows as any[]) ?? [];
  const filtered = useMemo(() => all.filter((r) => matches(tab, r.status)), [all, tab]);
  const current = active ? (all.find((r) => r.id === active.id) ?? active) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Returns & Exchanges</h1>
        <p className="text-sm text-muted-foreground">
          Requests submitted by customers from their order page.
        </p>
      </div>

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
          No {tab === "all" ? "" : tab} requests.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActive(r)}
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
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                    STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                {((r.items as any[]) ?? []).slice(0, 4).map((it: any, i: number) => (
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
                  {((r.items as any[]) ?? []).map((i: any) => i.name).join(", ")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2 py-0.5 capitalize">{r.type}</span>
                {(r.images ?? []).length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {(r.images as string[]).length}
                  </span>
                )}
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
                {Number(r.refund_amount ?? 0) > 0 && (
                  <span>Refund ৳{Number(r.refund_amount).toFixed(0)}</span>
                )}
              </div>

              {r.reason && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.reason}</p>}
            </button>
          ))}
        </div>
      )}

      {current && <ReturnDrawer key={current.id} request={current} onClose={() => setActive(null)} />}
    </div>
  );
}
