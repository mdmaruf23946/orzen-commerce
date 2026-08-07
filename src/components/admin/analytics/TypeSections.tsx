import { compactMoney } from "@/lib/analytics-ui";
import type { AnalyticsPayload } from "@/lib/analytics.server";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function TypeSections({ data }: { data: AnalyticsPayload }) {
  const { subscription, service, digital } = data;
  if (!subscription && !service && !digital) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Product Type Insights</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {subscription && (
          <Panel title="Subscriptions">
            <Stat label="Active" value={String(subscription.active)} />
            <Stat label="MRR" value={compactMoney(subscription.mrr)} />
            <Stat label="New" value={String(subscription.created)} />
            <Stat label="Cancelled" value={String(subscription.cancelled)} />
            <Stat label="Revenue" value={compactMoney(subscription.revenue)} />
            <Stat label="Active Rate" value={`${subscription.renewalRate.toFixed(0)}%`} />
          </Panel>
        )}
        {digital && (
          <Panel title="Digital Products">
            <Stat label="Orders" value={String(digital.orders)} />
            <Stat label="Downloads" value={String(digital.downloads)} />
            <Stat label="Revenue" value={compactMoney(digital.revenue)} />
            <Stat
              label="Top File"
              value={digital.top[0]?.name ? digital.top[0].name.slice(0, 12) : "—"}
            />
          </Panel>
        )}
        {service && (
          <Panel title="Services">
            <Stat label="Total" value={String(service.total)} />
            <Stat label="Completed" value={String(service.completed)} />
            <Stat label="In Progress" value={String(service.pending)} />
            <Stat label="Revenue" value={compactMoney(service.revenue)} />
          </Panel>
        )}
      </div>
    </section>
  );
}
