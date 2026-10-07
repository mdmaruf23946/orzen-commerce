import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { z } from "zod";
import { BrandMark } from "@/components/admin/payments/BrandMark";
import { StatusBadge } from "@/components/admin/payments/StatusBadge";
import { getBrand } from "@/components/admin/payments/providers";
import { WebhookEventsPanel } from "@/components/admin/payments/WebhookEventsPanel";
import { ConfigureForm, GatewayCard } from "@/components/admin/payments/GatewayParts";
import { PaymentKpis, RangePicker, sumStats, taka, usePaymentStats } from "@/components/admin/payments/PaymentStats";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { setActiveStorePaymentGateway, toggleStorePaymentGateway } from "@/lib/store-payments.functions";
import { PAYMENT_SECTIONS, gatewayStatus, isGatewayConnected, usePaymentGateways } from "@/lib/payment-gateway-apps";
import { cn } from "@/lib/utils";

const search = z.object({ section: z.enum(["overview", "integration", "settings"]).optional() });

export const Route = createFileRoute("/_authenticated/admin/payment-gateways/$gateway")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Payment Gateway — ORZEN Merchant Panel" },
      { name: "description", content: "Manage one payment gateway: payments, connection and settings." },
      { property: "og:title", content: "Payment Gateway — ORZEN Merchant Panel" },
      { property: "og:description", content: "Manage one payment gateway: payments, connection and settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { gateway } = Route.useParams();
  const { section } = Route.useSearch();
  const { storeId, gateways, isLoading } = usePaymentGateways();
  const g = gateways.find((x) => x.provider_id === gateway);
  if (isLoading) return <Skeleton className="mx-auto h-40 max-w-3xl rounded-xl" />;
  if (!g || !storeId)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        This gateway is not available. <Link to="/admin/payment-gateways/apps" className="text-primary underline">Back to Payment Gateway Apps</Link>
      </div>
    );
  const connected = isGatewayConnected(g.connection as any);
  const active = section ?? (connected ? "overview" : "integration");
  const brand = getBrand(g.provider_id, g as any);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <BrandMark brand={brand} logoUrl={g.logo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{g.label}</h1>
          <div className="mt-1"><StatusBadge status={gatewayStatus(g.connection as any)} color={brand.brandColor} /></div>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {PAYMENT_SECTIONS.map((s) => (
          <Link
            key={s.key}
            to="/admin/payment-gateways/$gateway"
            params={{ gateway }}
            search={{ section: s.key }}
            className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm", active === s.key ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </Link>
        ))}
      </div>
      {active === "overview" && <GatewayOverview storeId={storeId} gatewayId={g.provider_id} />}
      {active === "integration" && <GatewayIntegration storeId={storeId} g={g} />}
      {active === "settings" && <GatewaySettings storeId={storeId} g={g} />}
    </div>
  );
}

function GatewayOverview({ storeId, gatewayId }: { storeId: string; gatewayId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = usePaymentStats(storeId, days, gatewayId);
  const s = sumStats((data?.perGateway ?? []).filter((x) => x.gateway === gatewayId));
  const recent = (data?.recent ?? []).filter((r) => r.gateway === gatewayId);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><RangePicker value={days} onChange={setDays} /></div>
      <PaymentKpis s={s} loading={isLoading} />
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold">Recent payments</div>
        {recent.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data yet"}</div>
        ) : (
          <div className="divide-y">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.invoice_no ?? r.id.slice(0, 8)} · {r.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.payment_status}</div>
                </div>
                <div className="font-semibold">{taka(r.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GatewayIntegration({ storeId, g }: { storeId: string; g: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["storePaymentGateways", storeId] });
  return (
    <div className="space-y-4">
      <GatewayCard g={g} storeId={storeId} onConfigure={() => setOpen(true)} onChange={refresh} />
      {g.connection && (
        <WebhookEventsPanel storeId={storeId} providers={[{ provider_id: g.provider_id, label: g.label }]} />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <ConfigureForm
              g={g}
              storeId={storeId}
              onDone={() => {
                setOpen(false);
                refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GatewaySettings({ storeId, g }: { storeId: string; g: any }) {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleStorePaymentGateway);
  const setActive = useServerFn(setActiveStorePaymentGateway);
  const [busy, setBusy] = useState(false);
  const c = g.connection;
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["storePaymentGateways", storeId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }
  if (!c)
    return <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Connect this gateway in Integration first.</div>;
  return (
    <div className="divide-y rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium">Enabled</div>
          <div className="text-xs text-muted-foreground">Turn off to stop using {g.label}. Its menu will be removed until you turn it on again from Payment Gateway Apps.</div>
        </div>
        <Switch checked={c.enabled} disabled={busy} onCheckedChange={(v) => run(() => toggle({ data: { storeId, providerId: g.provider_id, enabled: v } }))} />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium">Default gateway</div>
          <div className="text-xs text-muted-foreground">The default gateway is shown first at checkout.</div>
        </div>
        {c.is_active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Star className="h-3.5 w-3.5 fill-current" /> Default</span>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setActive({ data: { storeId, providerId: g.provider_id } }))}>Make default</Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium">Checkout visibility</div>
          <div className="text-xs text-muted-foreground">
            {!g.storefrontCheckout
              ? "Checkout for this gateway is coming soon — it stays hidden at checkout for now."
              : c.enabled && isGatewayConnected(c)
                ? "Shown to customers at checkout."
                : "Hidden at checkout until enabled and connected."}
          </div>
        </div>
      </div>
    </div>
  );
}
