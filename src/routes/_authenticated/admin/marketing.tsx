import { createFileRoute } from "@tanstack/react-router";
import { updateMarketing } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: MarketingPage,
});

const defaults = {
  fb_pixel_id: "",
  fb_capi_token: "",
  fb_capi_enabled: false,
  ga4_id: "",
  gtm_id: "",
  tiktok_pixel_id: "",
  enabled: { fb_pixel: true, ga4: true, gtm: true, tiktok: true } as Record<string, boolean>,
};

function MarketingPage() {
  return (
    <SettingsPage
      title="Marketing"
      description="Tracking and analytics. Scripts load only when an ID is set and the channel is enabled."
      column="marketing"
      save={updateMarketing}
      defaults={defaults}
    >
      {(form, set) => {
        const en = form.enabled ?? {};
        const toggle = (k: string, v: boolean) => set("enabled", { ...en, [k]: v });
        const row = (label: string, key: string, idKey: keyof typeof defaults, placeholder: string) => (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch checked={en[key] !== false} onCheckedChange={(v) => toggle(key, v)} />
            </div>
            <Input
              value={(form as any)[idKey] ?? ""}
              onChange={(e) => set(idKey, e.target.value as any)}
              placeholder={placeholder}
            />
          </div>
        );
        return (
          <>
            {row("Facebook Pixel", "fb_pixel", "fb_pixel_id", "e.g. 1234567890")}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Facebook Conversion API (server-side)</Label>
                <Switch
                  checked={!!form.fb_capi_enabled}
                  onCheckedChange={(v) => set("fb_capi_enabled", v)}
                />
              </div>
              <Input
                value={form.fb_capi_token ?? ""}
                onChange={(e) => set("fb_capi_token", e.target.value)}
                placeholder="CAPI access token"
              />
            </div>
            {row("Google Analytics (GA4)", "ga4", "ga4_id", "G-XXXXXXXX")}
            {row("Google Tag Manager", "gtm", "gtm_id", "GTM-XXXXXX")}
            {row("TikTok Pixel (optional)", "tiktok", "tiktok_pixel_id", "C8XXXXXXXXXXXXXXXXXX")}
          </>
        );
      }}
    </SettingsPage>
  );
}
