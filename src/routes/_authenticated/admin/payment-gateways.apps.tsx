import { createFileRoute, Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { BrandMark } from "@/components/admin/payments/BrandMark";
import { StatusBadge } from "@/components/admin/payments/StatusBadge";
import { getBrand } from "@/components/admin/payments/providers";
import { CustomGatewaySection } from "@/components/admin/payments/CustomGatewaySection";
import { PaymentStatusRules } from "@/components/admin/payments/PaymentStatusRules";
import { Section } from "@/components/admin/payments/GatewayParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gatewayStatus, isGatewayConnected, usePaymentGateways } from "@/lib/payment-gateway-apps";

export const Route = createFileRoute("/_authenticated/admin/payment-gateways/apps")({
  head: () => ({
    meta: [
      { title: "Payment Gateway Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect payment gateways for your store." },
      { property: "og:title", content: "Payment Gateway Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect payment gateways for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  const { storeId, gateways, isLoading } = usePaymentGateways();
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Payment Gateway Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a gateway to get its own menu in the sidebar. Customer payments go directly to you.
        </p>
      </div>
      <div className="grid gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : gateways.map((g) => {
              const brand = getBrand(g.provider_id, g as any);
              const on = isGatewayConnected(g.connection as any);
              const wm = g.wordmark_url ? (g.wordmark_url.startsWith("http") ? g.wordmark_url : `/api/img/${g.wordmark_url}`) : null;
              return (
                <div key={g.provider_id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <BrandMark brand={brand} logoUrl={g.logo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {wm ? (
                        <img src={wm} alt={g.label} loading="lazy" className="h-5 max-w-[140px] object-contain" />
                      ) : (
                        <span className="font-medium" style={{ color: brand.brandColor }}>{g.label}</span>
                      )}
                      <StatusBadge status={gatewayStatus(g.connection as any)} color={brand.brandColor} />
                      {g.connection?.is_active && (
                        <Badge variant="outline" className="text-[10px]"><Star className="mr-1 h-3 w-3 fill-current" /> Default</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{brand.tagline}</p>
                  </div>
                  <Button asChild size="sm" variant={on ? "outline" : "default"}>
                    <Link to="/admin/payment-gateways/$gateway" params={{ gateway: g.provider_id }} search={{ section: on ? "overview" : "integration" }}>
                      {on ? "Manage" : "Connect"}
                    </Link>
                  </Button>
                </div>
              );
            })}
        {!isLoading && gateways.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No payment gateways are enabled for your store yet. Please contact support to enable providers.
          </div>
        )}
      </div>

      {storeId && <CustomGatewaySection storeId={storeId} />}
      <Section title="Order Status Rules" description="Decide which order status is applied after each type of payment. Shared by all gateways.">
        <PaymentStatusRules />
      </Section>
    </div>
  );
}
