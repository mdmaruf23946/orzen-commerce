import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, FlaskConical, PowerOff } from "lucide-react";
import { updateMarketing, getFacebookStatus, sendFbTestEvent } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: MarketingPage,
});

const defaults = {
  fb_pixel_id: "",
  fb_pixel_enabled: true,
  fb_capi_token: "",
  fb_capi_enabled: false,
  fb_test_event_code: "",
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
        const otherRow = (label: string, key: string, idKey: keyof typeof defaults, placeholder: string) => (
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
            <FacebookCard form={form} set={set} />
            {otherRow("Google Analytics (GA4)", "ga4", "ga4_id", "G-XXXXXXXX")}
            {otherRow("Google Tag Manager", "gtm", "gtm_id", "GTM-XXXXXX")}
            {otherRow("TikTok Pixel (optional)", "tiktok", "tiktok_pixel_id", "C8XXXXXXXXXXXXXXXXXX")}
          </>
        );
      }}
    </SettingsPage>
  );
}

function FacebookCard({
  form,
  set,
}: {
  form: any;
  set: (k: any, v: any) => void;
}) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getFacebookStatus);
  const sendTest = useServerFn(sendFbTestEvent);
  const { data: status } = useQuery({
    queryKey: ["fb", "status"],
    queryFn: () => getStatus(),
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    text: string;
  }>(null);

  const pixelInvalid = form.fb_pixel_id && !/^\d{15,17}$/.test(form.fb_pixel_id);
  const testCodeInvalid =
    form.fb_test_event_code && !/^[A-Za-z0-9_-]{4,40}$/.test(form.fb_test_event_code);
  const tokenTooShort =
    !!form.fb_capi_enabled && (!form.fb_capi_token || form.fb_capi_token.length < 40);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendTest();
      if ((res as any).ok) {
        const events = (res as any).events_received ?? 0;
        setTestResult({
          ok: true,
          text: `Meta received ${events} event${events === 1 ? "" : "s"} in ${(res as any).mode.toUpperCase()} mode. Check Events Manager → Test Events.`,
        });
        toast.success("Test event sent");
      } else {
        setTestResult({ ok: false, text: (res as any).error ?? "Failed" });
        toast.error((res as any).error ?? "Failed");
      }
      qc.invalidateQueries({ queryKey: ["fb", "status"] });
    } catch (e) {
      setTestResult({ ok: false, text: (e as Error).message });
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  const badge = statusBadge(status?.mode);

  return (
    <div className="space-y-4 rounded-lg border-2 border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Facebook / Meta Tracking</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Browser Pixel + server-side Conversion API with automatic deduplication.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>

      {/* Pixel */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Facebook Pixel ID</Label>
          <Switch
            checked={form.fb_pixel_enabled !== false}
            onCheckedChange={(v) => set("fb_pixel_enabled", v)}
          />
        </div>
        <Input
          value={form.fb_pixel_id ?? ""}
          onChange={(e) => set("fb_pixel_id", e.target.value.replace(/\D/g, ""))}
          placeholder="e.g. 1234567890123456"
          inputMode="numeric"
        />
        {pixelInvalid && (
          <p className="text-xs text-destructive">Pixel ID must be 15–17 digits.</p>
        )}
      </div>

      {/* CAPI token */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Conversion API — Access Token</Label>
          <Switch
            checked={!!form.fb_capi_enabled}
            onCheckedChange={(v) => set("fb_capi_enabled", v)}
          />
        </div>
        <Input
          type="password"
          value={form.fb_capi_token ?? ""}
          onChange={(e) => set("fb_capi_token", e.target.value)}
          placeholder="EAAB…"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Generate from Events Manager → Data Sources → Settings → Conversions API.
        </p>
        {tokenTooShort && (
          <p className="text-xs text-destructive">CAPI token looks too short.</p>
        )}
      </div>

      {/* Test Event Code */}
      <div className="space-y-1.5">
        <Label>Test Event Code (optional)</Label>
        <Input
          value={form.fb_test_event_code ?? ""}
          onChange={(e) => set("fb_test_event_code", e.target.value.trim())}
          placeholder="TEST12345"
        />
        <p className="text-xs text-muted-foreground">
          When set, all events are sent to Meta <b>Test Events</b>. Leave empty to switch back to Live mode automatically.
        </p>
        {testCodeInvalid && (
          <p className="text-xs text-destructive">Invalid test event code.</p>
        )}
      </div>

      {/* Send test button */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={runTest}
          disabled={testing || !status?.pixel_id || !status?.capi_enabled}
        >
          <FlaskConical className="mr-1 h-4 w-4" />
          {testing ? "Sending…" : "Send Test Event"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Saves must be applied before testing.
        </span>
      </div>
      {testResult && (
        <div
          className={`rounded-md border p-2 text-xs ${
            testResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.text}
        </div>
      )}

      <div className="rounded-md border bg-white/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <div className="font-medium text-foreground">Auto-tracked events</div>
        PageView · ViewContent · Search · AddToCart · InitiateCheckout · AddPaymentInfo ·
        Purchase · CompleteRegistration. Each event fires on the browser (Pixel) and on
        the server (CAPI) with a shared <code>event_id</code> so Meta deduplicates. Hashed
        user_data (email, phone, external_id) plus IP and user-agent are sent when
        available.
      </div>
    </div>
  );
}

function statusBadge(mode: string | undefined) {
  switch (mode) {
    case "live":
      return {
        label: "Live",
        cls: "bg-emerald-100 text-emerald-800",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case "test":
      return {
        label: "Test Mode",
        cls: "bg-amber-100 text-amber-800",
        icon: <FlaskConical className="h-3.5 w-3.5" />,
      };
    case "off":
      return {
        label: "Not configured",
        cls: "bg-neutral-200 text-neutral-700",
        icon: <PowerOff className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: "Unknown",
        cls: "bg-neutral-200 text-neutral-700",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      };
  }
}
