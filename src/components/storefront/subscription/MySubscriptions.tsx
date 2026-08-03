// Customer dashboard: manage recurring subscriptions for one store.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStoreBySlug } from "@/lib/storefront.functions";
import {
  listMySubscriptions,
  cancelMySubscription,
  setMyAutoRenew,
  setMyReminders,
  renewMySubscription,
} from "@/lib/subscriptions.functions";
import { CYCLE_LABEL, STATUS_LABEL, STATUS_TONE, type SubStatus } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { RefreshCw, CalendarClock, ReceiptText, XCircle } from "lucide-react";

const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

function taka(n: any) {
  return `৳${Number(n || 0).toLocaleString()}`;
}
function fmt(v?: string | null) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

export function MySubscriptions({ slug, token }: { slug: string; token: string }) {
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const listFn = useServerFn(listMySubscriptions);
  const cancelFn = useServerFn(cancelMySubscription);
  const autoFn = useServerFn(setMyAutoRenew);
  const remFn = useServerFn(setMyReminders);
  const renewFn = useServerFn(renewMySubscription);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: subs = [], isLoading } = useQuery({
    enabled: !!store?.id,
    queryKey: ["mySubscriptions", store?.id],
    queryFn: () => listFn({ data: { storeId: (store as any).id, token } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["mySubscriptions"] });

  async function run(id: string, fn: () => Promise<any>, msg: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>;
  if (!subs.length)
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        You have no subscriptions yet.
      </div>
    );

  return (
    <div className="space-y-3">
      {(subs as any[]).map((s) => {
        const status = (s.status ?? "pending") as SubStatus;
        const invoices: any[] = s.invoices ?? [];
        const open = openId === s.id;
        return (
          <div key={s.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{s.plan_name}</div>
                <div className="text-[11px] text-neutral-500">{s.subscription_no}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[status] ?? "bg-neutral-100"}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <div className="text-neutral-500">Price</div>
                <div className="font-medium">{taka(s.price)}</div>
              </div>
              <div>
                <div className="text-neutral-500">Cycle</div>
                <div className="font-medium">{CYCLE_LABEL[s.billing_cycle as keyof typeof CYCLE_LABEL] ?? s.billing_cycle}</div>
              </div>
              <div>
                <div className="text-neutral-500">Next billing</div>
                <div className="font-medium">{fmt(s.next_billing_date)}</div>
              </div>
              <div>
                <div className="text-neutral-500">Renews at</div>
                <div className="font-medium">{taka(s.renewal_price ?? s.price)}</div>
              </div>
            </div>

            {s.trial_ends_at && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-sky-50 p-2 text-[11px] text-sky-800">
                <CalendarClock className="h-3.5 w-3.5" /> Trial ends {fmt(s.trial_ends_at)}
              </div>
            )}
            {s.cancel_at_period_end && (
              <div className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                Cancels on {fmt(s.current_period_end)} — access stays until then.
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busy === s.id}
                onClick={() =>
                  run(
                    s.id,
                    () => autoFn({ data: { storeId: (store as any).id, token, subscriptionId: s.id, autoRenew: !s.auto_renew } }),
                    s.auto_renew ? "Auto-renew turned off" : "Auto-renew turned on",
                  )
                }
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Auto-renew: {s.auto_renew ? "On" : "Off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busy === s.id}
                onClick={() =>
                  run(
                    s.id,
                    () => remFn({ data: { storeId: (store as any).id, token, subscriptionId: s.id, optIn: !s.reminders_opt_in } }),
                    "Reminder preference saved",
                  )
                }
              >
                Reminders: {s.reminders_opt_in ? "On" : "Off"}
              </Button>
              {s.billing_cycle !== "lifetime" && !["cancelled", "expired"].includes(status) && (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy === s.id}
                  onClick={() =>
                    run(
                      s.id,
                      () => renewFn({ data: { storeId: (store as any).id, token, subscriptionId: s.id } }),
                      "Renewal invoice created",
                    )
                  }
                >
                  Renew now
                </Button>
              )}
              {!["cancelled", "expired"].includes(status) && !s.cancel_at_period_end && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-rose-600"
                  disabled={busy === s.id}
                  onClick={() => {
                    if (!confirm("Cancel this subscription at the end of the current period?")) return;
                    run(
                      s.id,
                      () => cancelFn({ data: { storeId: (store as any).id, token, subscriptionId: s.id } }),
                      "Cancellation scheduled",
                    );
                  }}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              {invoices.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <ReceiptText className="mr-1 h-3.5 w-3.5" /> Invoices ({invoices.length})
                </Button>
              )}
            </div>

            {open && (
              <div className="mt-3 space-y-1 rounded-lg bg-neutral-50 p-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono">{inv.invoice_no}</span>
                    <span className="text-neutral-500">{fmt(inv.created_at)}</span>
                    <span>{taka(inv.total)}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 ${
                        inv.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
