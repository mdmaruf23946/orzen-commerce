import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { updateCouriers } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/couriers")({
  component: () => <FeatureGate feature="courier"><CouriersPage /></FeatureGate>,
});

const providers = [
  { key: "steadfast", label: "SteadFast" },
  { key: "pathao", label: "Pathao Courier" },
  { key: "redx", label: "RedX" },
  { key: "paperfly", label: "Paperfly" },
] as const;

type Provider = { api_key?: string; secret?: string; base_url?: string; enabled?: boolean };
const defaults = {
  steadfast: {} as Provider,
  pathao: {} as Provider,
  redx: {} as Provider,
  paperfly: {} as Provider,
};

function CouriersPage() {
  return (
    <SettingsPage
      title="Courier Integration"
      description="Connect couriers to create parcels and sync delivery status. Adapters ship as we add support."
      column="couriers"
      save={updateCouriers}
      defaults={defaults}
    >
      {(form, set) => (
        <div className="space-y-6">
          {providers.map((p) => {
            const cur: Provider = (form as any)[p.key] ?? {};
            const update = (patch: Partial<Provider>) => set(p.key as any, { ...cur, ...patch } as any);
            return (
              <div key={p.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{p.label}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Enabled
                    <Switch
                      checked={!!cur.enabled}
                      onCheckedChange={(v) => update({ enabled: v })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>API Key</Label>
                    <Input value={cur.api_key ?? ""} onChange={(e) => update({ api_key: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Secret</Label>
                    <Input
                      type="password"
                      value={cur.secret ?? ""}
                      onChange={(e) => update({ secret: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Base URL (optional)</Label>
                  <Input
                    value={cur.base_url ?? ""}
                    onChange={(e) => update({ base_url: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsPage>
  );
}
