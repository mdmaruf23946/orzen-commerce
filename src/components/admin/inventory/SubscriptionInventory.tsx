import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { inventorySubscription, subscriptionSubscribers } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiStrip, Pill, ItemCard, Facts, EmptyBox, money, exportCsv, fmtDate } from "./kit";
import { CYCLE_LABEL, STATUS_LABEL, type SubCycle, type SubStatus } from "@/lib/subscriptions";

export function SubscriptionInventory({ search }: { search: string }) {
  const listFn = useServerFn(inventorySubscription);
  const subsFn = useServerFn(subscriptionSubscribers);
  const [subsFor, setSubsFor] = useState<any | null>(null);

  const { data: items = [] } = useQuery({ queryKey: ["inv", "subscription"], queryFn: () => listFn() });
  const { data: subscribers = [] } = useQuery({
    queryKey: ["inv", "subscription", "subs", subsFor?.id],
    queryFn: () => subsFn({ data: { productId: subsFor.id } }),
    enabled: !!subsFor,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items as any[]).filter((p) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [items, search]);

  const kpis = useMemo(() => {
    const all = items as any[];
    const rates = all.filter((p) => p.renewalRate != null);
    return [
      { label: "Plans", value: all.length },
      { label: "Active subscribers", value: all.reduce((s, p) => s + p.active, 0) },
      { label: "Trial users", value: all.reduce((s, p) => s + p.trialing, 0) },
      { label: "Monthly revenue", value: money(all.reduce((s, p) => s + p.mrr, 0)) },
      { label: "Renewals (30d)", value: all.reduce((s, p) => s + p.renewalsDue, 0) },
      {
        label: "Renewal rate",
        value: rates.length ? `${Math.round(rates.reduce((s, p) => s + p.renewalRate, 0) / rates.length)}%` : "—",
      },
    ];
  }, [items]);

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/admin/products">Manage plans</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportCsv(
              "inventory-subscription.csv",
              (items as any[]).map((p) => ({
                Plan: p.name,
                Active: p.active,
                Trial: p.trialing,
                Expired: p.expired,
                Cancelled: p.cancelled,
                "Renewal rate": p.renewalRate ?? "",
                MRR: p.mrr,
                Cycle: p.billingCycle ?? "",
              })),
            )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyBox>No subscription products yet.</EmptyBox>
      ) : (
        <div className="space-y-2">
          {rows.map((p: any) => (
            <ItemCard
              key={p.id}
              image={p.image}
              title={p.name}
              subtitle={p.billingCycle ? CYCLE_LABEL[p.billingCycle as SubCycle] ?? p.billingCycle : undefined}
              right={p.active > 0 ? <Pill tone="green">{p.active} active</Pill> : <Pill tone="gray">No subscribers</Pill>}
            >
              <Facts
                items={[
                  { label: "Active", value: p.active },
                  { label: "Trial", value: p.trialing },
                  { label: "Expired", value: p.expired },
                  { label: "Cancelled", value: p.cancelled },
                  { label: "Renewal rate", value: p.renewalRate == null ? "—" : `${p.renewalRate}%` },
                  { label: "Renewals (30d)", value: p.renewalsDue },
                  { label: "Monthly revenue", value: money(p.mrr) },
                  { label: "Price", value: money(p.price) },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSubsFor(p)}>
                  View subscribers
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/admin/orders">Open orders</Link>
                </Button>
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {subsFor && (
        <Dialog open onOpenChange={(o) => !o && setSubsFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">Subscribers — {subsFor.name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {(subscribers as any[]).length === 0 && <p className="text-sm text-muted-foreground">No subscribers yet.</p>}
              {(subscribers as any[]).map((s) => (
                <div key={s.id} className="rounded-lg border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.customer_name ?? s.customer_email ?? s.customer_phone ?? "—"}</span>
                    <Pill tone={s.status === "active" ? "green" : s.status === "trialing" ? "blue" : "gray"}>
                      {STATUS_LABEL[s.status as SubStatus] ?? s.status}
                    </Pill>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {s.subscription_no ? `${s.subscription_no} · ` : ""}
                    {money(s.renewal_price ?? s.price)} · Next: {fmtDate(s.next_billing_date)}
                  </div>
                </div>
              ))}
            </div>
            {(subscribers as any[]).length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCsv(
                    `subscribers-${subsFor.name}.csv`,
                    (subscribers as any[]).map((s) => ({
                      Subscription: s.subscription_no ?? "",
                      Customer: s.customer_name ?? "",
                      Email: s.customer_email ?? "",
                      Phone: s.customer_phone ?? "",
                      Status: s.status,
                      Cycle: s.billing_cycle,
                      Amount: s.renewal_price ?? s.price,
                      "Next billing": s.next_billing_date ?? "",
                    })),
                  )
                }
              >
                <Download className="mr-1 h-4 w-4" /> Export subscribers
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
