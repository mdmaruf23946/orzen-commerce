import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ownerCustomerStats } from "@/lib/owner.functions";
import { Users, UserCheck, Store as StoreIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/customers")({
  component: OwnerCustomersPage,
});

function OwnerCustomersPage() {
  const fn = useServerFn(ownerCustomerStats);
  const { data, isLoading } = useQuery({ queryKey: ["owner", "customer-stats"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer Accounts</h1>
        <p className="text-sm text-muted-foreground">Cross-store customer statistics. Store owners only see their own customers.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total accounts" value={data?.total ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active accounts" value={data?.active ?? 0} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Stores with customers" value={data?.byStore.length ?? 0} icon={<StoreIcon className="h-5 w-5" />} />
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Top stores by customer count</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (data?.byStore ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No customers yet.</p>
        ) : (
          <ul className="divide-y">
            {data!.byStore.map((s) => (
              <li key={s.store_id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{s.name} <span className="ml-1 text-xs text-muted-foreground">/{s.slug}</span></span>
                <span className="font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent signups</h2>
        {(data?.recent ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No signups yet.</p>
        ) : (
          <ul className="divide-y">
            {data!.recent.map((c: any) => (
              <li key={c.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.email || c.phone} · {c.store_name}</div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div>
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
      </div>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
    </div>
  );
}
