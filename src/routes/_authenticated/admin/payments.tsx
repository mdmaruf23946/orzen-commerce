import { createFileRoute } from "@tanstack/react-router";
import { updatePayments } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
});

const defaults: {
  cod: { enabled: boolean };
  bkash: { enabled: boolean; number: string };
  nagad: { enabled: boolean; number: string };
  rocket: { enabled: boolean; number: string };
  bank: { enabled: boolean; name: string; account: string; branch: string };
  instructions: string;
} = {
  cod: { enabled: true },
  bkash: { enabled: false, number: "" },
  nagad: { enabled: false, number: "" },
  rocket: { enabled: false, number: "" },
  bank: { enabled: false, name: "", account: "", branch: "" },
  instructions: "",
};

type Mobile = { enabled: boolean; number: string };
function MobileMethod({
  label,
  v,
  onChange,
}: {
  label: string;
  v: Mobile;
  onChange: (next: Mobile) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Switch checked={!!v.enabled} onCheckedChange={(en) => onChange({ ...v, enabled: en })} />
      </div>
      <Input
        placeholder="Phone number"
        value={v.number ?? ""}
        onChange={(e) => onChange({ ...v, number: e.target.value })}
      />
    </div>
  );
}

function PaymentsPage() {
  return (
    <SettingsPage
      title="Payment Settings"
      description="Enable or disable each payment method customers see at checkout."
      column="payments_config"
      save={updatePayments}
      defaults={defaults}
    >
      {(form, set) => (
        <>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Cash on Delivery</Label>
            <Switch
              checked={form.cod?.enabled !== false}
              onCheckedChange={(v) => set("cod", { enabled: v })}
            />
          </div>
          <MobileMethod label="bKash" v={form.bkash ?? {}} onChange={(v) => set("bkash", v)} />
          <MobileMethod label="Nagad" v={form.nagad ?? {}} onChange={(v) => set("nagad", v)} />
          <MobileMethod label="Rocket" v={form.rocket ?? {}} onChange={(v) => set("rocket", v)} />
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Bank Account (optional)</Label>
              <Switch
                checked={!!form.bank?.enabled}
                onCheckedChange={(v) => set("bank", { ...(form.bank ?? {}), enabled: v })}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Bank name"
                value={form.bank?.name ?? ""}
                onChange={(e) => set("bank", { ...(form.bank ?? {}), name: e.target.value })}
              />
              <Input
                placeholder="Account number"
                value={form.bank?.account ?? ""}
                onChange={(e) => set("bank", { ...(form.bank ?? {}), account: e.target.value })}
              />
              <Input
                placeholder="Branch"
                value={form.bank?.branch ?? ""}
                onChange={(e) => set("bank", { ...(form.bank ?? {}), branch: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Instructions</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Send money, then paste the Transaction ID at checkout."
              value={form.instructions ?? ""}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>
        </>
      )}
    </SettingsPage>
  );
}
