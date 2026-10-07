import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/admin/payments/BrandMark";
import { getBrand } from "@/components/admin/payments/providers";
import { PaymentKpis, RangePicker, sumStats, taka, usePaymentStats } from "@/components/admin/payments/PaymentStats";
import { isGatewayConnected, usePaymentGateways } from "@/lib/payment-gateway-apps";

export const Route = createFileRoute("/_authenticated/admin/payment-gateways/overview")({
  head: () => ({
    meta: [
      { title: "Payment Overview — ORZEN Merchant Panel" },
      { name: "description", content: "Combined payment performance of all connected gateways." },
      { property: "og:title", content: "Payment Overview — ORZEN Merchant Panel" },
      { property: "og:description", content: "Combined payment performance of all connected gateways." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const [days, setDays] = useState(30);
  const { storeId, gateways } = usePaymentGateways();
  const { data, isLoading } = usePaymentStats(storeId, days);
  const connected = gateways.filter((g) => isGatewayConnected(g.connection as any));
  const ids = new Set(connected.map((g) => g.provider_id));
  const per = (data?.perGateway ?? []).filter((s) => ids.has(s.gateway));
  const total = sumStats(per);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payment Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">All connected gateways together.</p>
        </div>
        <RangePicker value={days} onChange={setDays} />
      </div>

      {connected.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No gateway is connected yet.{" "}
          <Link to="/admin/payment-gateways/apps" className="text-primary underline">Connect one</Link>
        </div>
      ) : (
        <>
          <PaymentKpis s={total} loading={isLoading} />
          <section className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3 text-sm font-semibold">By gateway</div>
            <div className="divide-y">
              {connected.map((g) => {
                const s = per.find((x) => x.gateway === g.provider_id);
                return (
                  <Link
                    key={g.provider_id}
                    to="/admin/payment-gateways/$gateway"
                    params={{ gateway: g.provider_id }}
                    search={{ section: "overview" }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                  >
                    <BrandMark brand={getBrand(g.provider_id, g as any)} logoUrl={g.logo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{g.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s ? `${s.total} payments · ${s.successful} paid · ${s.failed} failed · ${s.pending} pending` : "No data yet"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{s ? taka(s.amount) : "—"}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
