import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { myDashboardStats, getMyStore } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const statsFn = useServerFn(myDashboardStats);
  const storeFn = useServerFn(getMyStore);
  const { data: stats } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => statsFn() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });

  const cards = [
    { label: "Today's Sales", value: `৳${(stats?.todaySales ?? 0).toFixed(0)}`, icon: TrendingUp },
    { label: "Total Sales", value: `৳${(stats?.totalSales ?? 0).toFixed(0)}`, icon: Wallet },
    { label: "Orders", value: stats?.totalOrders ?? 0, icon: ShoppingBag },
    { label: "Products", value: stats?.totalProducts ?? 0, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          {store && (
            <p className="text-sm text-muted-foreground">
              Your store:{" "}
              <Link
                to="/store/$slug"
                params={{ slug: store.slug }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                /store/{store.slug}
              </Link>
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
