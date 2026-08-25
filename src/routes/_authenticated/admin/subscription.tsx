import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mySubscription } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/subscription")({
  head: () => ({
    meta: [
      { title: "My Subscription — ORZEN Merchant Panel" },
      { name: "description", content: "Your current Orzen plan and renewal details." },
      { property: "og:title", content: "My Subscription — ORZEN Merchant Panel" },
      { property: "og:description", content: "Your current Orzen plan and renewal details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const fn = useServerFn(mySubscription);
  const { data } = useQuery({ queryKey: ["admin", "subscription"], queryFn: () => fn() });
  const store = data?.store;
  const pkg = (store as any)?.subscription_packages;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Subscription</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Current package</div>
          <div className="mt-1 text-lg font-semibold">{pkg?.name ?? "Free"}</div>
          {pkg && (
            <div className="mt-2 text-sm text-muted-foreground">
              ৳{Number(pkg.price).toFixed(0)} / {pkg.duration_days} days · {pkg.product_limit} products
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Expires on</div>
          <div className="mt-1 text-lg font-semibold">
            {store?.expires_at ? new Date(store.expires_at).toLocaleDateString() : "—"}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Contact the platform owner to renew or upgrade your package.
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold">Payment history</h2>
        <div className="mt-3 overflow-hidden rounded-xl border bg-card">
          {(data?.payments ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No payments yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Txn ID</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="p-3 uppercase">{p.method}</td>
                    <td className="p-3 font-mono text-xs">{p.txn_id || "—"}</td>
                    <td className="p-3 text-right">৳{Number(p.amount).toFixed(0)}</td>
                    <td className="p-3 capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
