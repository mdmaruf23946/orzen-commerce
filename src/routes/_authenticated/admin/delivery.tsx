import { createFileRoute } from "@tanstack/react-router";
import { updateDelivery } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  component: DeliveryPage,
});

const defaults = {
  inside_city: 0,
  outside_city: 0,
  free_min: 0,
  cod_enabled: true,
};

function DeliveryPage() {
  return (
    <SettingsPage
      title="Delivery Settings"
      description="Shipping charges and Cash on Delivery."
      column="delivery"
      save={updateDelivery}
      defaults={defaults}
    >
      {(form, set) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Inside City Charge (৳)</Label>
              <Input
                type="number"
                min={0}
                value={form.inside_city}
                onChange={(e) => set("inside_city", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Outside City Charge (৳)</Label>
              <Input
                type="number"
                min={0}
                value={form.outside_city}
                onChange={(e) => set("outside_city", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Free Delivery Minimum (৳, 0 = disabled)</Label>
            <Input
              type="number"
              min={0}
              value={form.free_min}
              onChange={(e) => set("free_min", Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Cash on Delivery</Label>
            <Switch checked={!!form.cod_enabled} onCheckedChange={(v) => set("cod_enabled", v)} />
          </div>
        </>
      )}
    </SettingsPage>
  );
}
