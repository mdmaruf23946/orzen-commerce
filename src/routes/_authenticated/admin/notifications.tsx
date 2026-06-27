import { createFileRoute } from "@tanstack/react-router";
import { updateNotifications } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
});

const defaults = {
  whatsapp: "",
  email_enabled: true,
  sms_api_placeholder: "",
};

function NotificationsPage() {
  return (
    <SettingsPage
      title="Notification Settings"
      description="Where order updates are sent."
      column="notifications"
      save={updateNotifications}
      defaults={defaults}
    >
      {(form, set) => (
        <>
          <div className="space-y-1.5">
            <Label>WhatsApp Number (orders notifications)</Label>
            <Input value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Email Notifications</Label>
            <Switch checked={!!form.email_enabled} onCheckedChange={(v) => set("email_enabled", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>SMS API (coming soon)</Label>
            <Input
              disabled
              placeholder="SMS provider integration coming soon"
              value={form.sms_api_placeholder ?? ""}
              onChange={(e) => set("sms_api_placeholder", e.target.value)}
            />
          </div>
        </>
      )}
    </SettingsPage>
  );
}
