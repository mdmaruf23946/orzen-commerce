import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Store as StoreIcon, CheckCircle2, Pause, Wallet } from "lucide-react";
import { ownerDashboardStats } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/owner/")({
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const fn = useServerFn(ownerDashboardStats);
  const { data } = useQuery({ queryKey: ["owner", "stats"], queryFn: () => fn() });

  const cards = [
    { label: "Total Users", value: data?.users ?? 0, icon: Users },
    { label: "Total Stores", value: data?.stores ?? 0, icon: StoreIcon },
    { label: "Active Stores", value: data?.active ?? 0, icon: CheckCircle2 },
    { label: "Suspended", value: data?.suspended ?? 0, icon: Pause },
    { label: "Revenue", value: `৳${(data?.revenue ?? 0).toFixed(0)}`, icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Platform Overview</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
