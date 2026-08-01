import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Mail, RotateCcw, Ban, CheckCircle2, Search } from "lucide-react";
import {
  listDigitalOrders,
  resetDownloadLimit,
  setDownloadAccess,
  resendDownloadEmail,
  releaseOrderDownloads,
} from "@/lib/digital.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/digital-orders")({
  head: () => ({
    meta: [
      { title: "Digital Orders — ORZEN Store Admin" },
      { name: "description", content: "Track digital purchases, downloads, license delivery and access for your store." },
    ],
  }),
  component: DigitalOrdersPage,
});

function statusTone(s: string) {
  if (s === "active") return "bg-emerald-100 text-emerald-700";
  if (s === "revoked") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function DigitalOrdersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["digital-orders"],
    queryFn: () => listDigitalOrders(),
  });
  const reset = useServerFn(resetDownloadLimit);
  const access = useServerFn(setDownloadAccess);
  const resend = useServerFn(resendDownloadEmail);
  const release = useServerFn(releaseOrderDownloads);

  const orders: any[] = (data as any)?.orders ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) =>
      [o.invoice_no, o.customer_name, o.phone, o.order_id, ...o.files.map((f: any) => f.product_name)]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term)),
    );
  }, [orders, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["digital-orders"] });

  const run = async (fn: () => Promise<any>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  const totals = useMemo(() => {
    const files = orders.flatMap((o) => o.files);
    return {
      orders: orders.length,
      active: files.filter((f: any) => f.status === "active").length,
      locked: files.filter((f: any) => f.status === "locked").length,
      downloads: files.reduce((a: number, f: any) => a + (f.download_count ?? 0), 0),
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Digital Orders</h1>
        <p className="text-sm text-muted-foreground">
          Every digital purchase, its download entitlements and license delivery.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Digital orders", value: totals.orders },
          { label: "Unlocked files", value: totals.active },
          { label: "Awaiting unlock", value: totals.locked },
          { label: "Total downloads", value: totals.downloads },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-3">
            <div className="text-[11px] uppercase text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order, customer or product…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <Download className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No digital orders yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <li key={o.order_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">
                    #{o.invoice_no || o.order_id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.customer_name}
                    {o.phone ? ` · ${o.phone}` : ""} ·{" "}
                    {o.created_at ? new Date(o.created_at).toLocaleString() : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      o.payment_status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {String(o.payment_status).toUpperCase()}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(() => release({ data: { orderId: o.order_id } }), "Downloads released")
                    }
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Release
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(() => resend({ data: { orderId: o.order_id } }), "Download email sent")
                    }
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" /> Resend email
                  </Button>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {o.files.map((f: any) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {f.product_name}
                        {f.file_label ? ` — ${f.file_label}` : ""}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        {f.version && <span>v{f.version}</span>}
                        <span>
                          {f.download_count} / {f.max_downloads ?? "∞"} downloads
                        </span>
                        {f.expires_at && (
                          <span>expires {new Date(f.expires_at).toLocaleDateString()}</span>
                        )}
                        {f.last_downloaded_at && (
                          <span>last {new Date(f.last_downloaded_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(f.status)}`}>
                        {String(f.status).toUpperCase()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => reset({ data: { id: f.id } }), "Limit reset")}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(
                            () =>
                              access({
                                data: {
                                  id: f.id,
                                  status: f.status === "revoked" ? "active" : "revoked",
                                },
                              }),
                            f.status === "revoked" ? "Access restored" : "Access cancelled",
                          )
                        }
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        {f.status === "revoked" ? "Restore" : "Cancel"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
