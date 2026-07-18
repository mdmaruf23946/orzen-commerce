import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listPlatformPaymentGateways,
  togglePlatformPaymentGateway,
} from "@/lib/store-payments.functions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/payment-gateways")({
  component: OwnerPaymentGateways,
});

function OwnerPaymentGateways() {
  const list = useServerFn(listPlatformPaymentGateways);
  const toggle = useServerFn(togglePlatformPaymentGateway);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ownerPaymentGateways"], queryFn: () => list() });

  async function onToggle(id: string, enabled: boolean) {
    try {
      await toggle({ data: { providerId: id, enabled } });
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["ownerPaymentGateways"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Storefront Payment Gateways</h1>
        <p className="text-sm text-muted-foreground">
          Enable providers that store owners can connect from their admin panel.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.id}</div>
              </div>
              <Switch
                checked={p.enabled}
                onCheckedChange={(v) => onToggle(p.id, v)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(p.methods ?? []).slice(0, 5).map((m: string) => (
                <Badge key={m} variant="outline" className="text-[10px]">
                  {m}
                </Badge>
              ))}
            </div>
            {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
