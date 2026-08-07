import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Save, ShieldCheck } from "lucide-react";
import {
  updateMarketingGoogle,
  getGoogleStatus,
  sendGa4TestEvent,
  sendGoogleAdsTestConversion,
  verifyGtmInstallation,
} from "@/lib/marketing.functions";
import { googleDefaults, GA4_ID_RE, ADS_ID_RE, GTM_ID_RE } from "@/lib/marketing.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Row, StatusBadge, TestResult, AUTO_EVENTS, type StatusKind } from "./ui";
import { useMarketingForm } from "./useMarketingForm";

export function GoogleTab() {
  const { form, set, saving, submit } = useMarketingForm("google", googleDefaults, updateMarketingGoogle);
  const qc = useQueryClient();
  const getStatus = useServerFn(getGoogleStatus);
  const ga4Test = useServerFn(sendGa4TestEvent);
  const adsTest = useServerFn(sendGoogleAdsTestConversion);
  const gtmVerify = useServerFn(verifyGtmInstallation);
  const { data: status } = useQuery({ queryKey: ["google", "status"], queryFn: () => getStatus() });

  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const ga4Invalid = !!form.ga4_id && !GA4_ID_RE.test(form.ga4_id);
  const adsInvalid = !!form.ads_conversion_id && !ADS_ID_RE.test(form.ads_conversion_id);
  const gtmInvalid = !!form.gtm_id && !GTM_ID_RE.test(form.gtm_id);

  const kind = (configured: boolean, enabled: boolean, test = false): StatusKind =>
    !configured ? "not_configured" : test ? "test" : enabled ? "connected" : "not_configured";

  async function run(key: string, fn: () => Promise<any>) {
    setBusy(key);
    setRes((r) => ({ ...r, [key]: null }));
    try {
      const out: any = await fn();
      const ok = !!out?.ok;
      const text = ok ? out.message ?? "Success — Google accepted the request." : out?.error ?? "Failed";
      setRes((r) => ({ ...r, [key]: { ok, text } }));
      ok ? toast.success(text) : toast.error(text);
      qc.invalidateQueries({ queryKey: ["google", "status"] });
    } catch (e) {
      setRes((r) => ({ ...r, [key]: { ok: false, text: (e as Error).message } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Google Analytics 4"
        description="Browser gtag plus server-side Measurement Protocol."
        status={<StatusBadge kind={kind(!!status?.ga4.configured, !!status?.ga4.enabled, !!status?.ga4.server_side && !!form.ga4_test_event && false)} />}
      >
        <Row label="Enable Google Analytics 4" checked={!!form.ga4_enabled} onCheckedChange={(v) => set("ga4_enabled", v)} />
        <Row label="Measurement ID" error={ga4Invalid && "Should look like G-XXXXXXX."}>
          <Input value={form.ga4_id ?? ""} onChange={(e) => set("ga4_id", e.target.value.trim())} placeholder="G-XXXXXXX" />
        </Row>
        <Row label="API Secret" hint="Admin → Data Streams → Measurement Protocol API secrets. Required for server-side events.">
          <Input
            type="password"
            autoComplete="off"
            value={form.ga4_api_secret ?? ""}
            onChange={(e) => set("ga4_api_secret", e.target.value.trim())}
            placeholder="••••••••"
          />
        </Row>
        <Row label="Test Event Name">
          <Input value={form.ga4_test_event ?? ""} onChange={(e) => set("ga4_test_event", e.target.value.trim())} placeholder="test_event" />
        </Row>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy === "ga4" || !status?.ga4.server_side}
          onClick={() => run("ga4", () => ga4Test())}
        >
          <FlaskConical className="mr-1.5 h-4 w-4" />
          {busy === "ga4" ? "Sending…" : "Send Test Event"}
        </Button>
        <TestResult result={res.ga4 ?? null} />
        <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Automatic e-commerce events: </span>
          {AUTO_EVENTS} — mapped to GA4 names (view_item, add_to_cart, begin_checkout, purchase…).
        </div>
      </Card>

      <Card
        title="Google Ads"
        description="Purchase conversion tracking with dynamic value, currency and transaction ID."
        status={<StatusBadge kind={kind(!!status?.ads.configured, !!status?.ads.enabled)} />}
      >
        <Row label="Enable Google Ads" checked={!!form.ads_enabled} onCheckedChange={(v) => set("ads_enabled", v)} />
        <Row label="Conversion ID" error={adsInvalid && "Should look like AW-123456789."}>
          <Input value={form.ads_conversion_id ?? ""} onChange={(e) => set("ads_conversion_id", e.target.value.trim())} placeholder="AW-123456789" />
        </Row>
        <Row label="Conversion Label">
          <Input value={form.ads_conversion_label ?? ""} onChange={(e) => set("ads_conversion_label", e.target.value.trim())} placeholder="AbC-D_efGh12" />
        </Row>
        <Row
          label="Purchase conversion tracking"
          hint="Sends the real order value, currency and transaction ID on every completed order."
          checked={form.ads_purchase_tracking !== false}
          onCheckedChange={(v) => set("ads_purchase_tracking", v)}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy === "ads"} onClick={() => run("ads", () => adsTest())}>
          <FlaskConical className="mr-1.5 h-4 w-4" />
          {busy === "ads" ? "Testing…" : "Test Conversion"}
        </Button>
        <TestResult result={res.ads ?? null} />
      </Card>

      <Card
        title="Google Tag Manager"
        description="Container loaded on every storefront page."
        status={<StatusBadge kind={kind(!!status?.gtm.configured, !!status?.gtm.enabled)} />}
      >
        <Row label="Enable Tag Manager" checked={!!form.gtm_enabled} onCheckedChange={(v) => set("gtm_enabled", v)} />
        <Row label="Container ID" error={gtmInvalid && "Should look like GTM-XXXXX."}>
          <Input value={form.gtm_id ?? ""} onChange={(e) => set("gtm_id", e.target.value.trim())} placeholder="GTM-XXXXX" />
        </Row>
        <Button type="button" variant="outline" size="sm" disabled={busy === "gtm"} onClick={() => run("gtm", () => gtmVerify())}>
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          {busy === "gtm" ? "Verifying…" : "Verify Installation"}
        </Button>
        <TestResult result={res.gtm ?? null} />
      </Card>

      <Button onClick={() => submit()} disabled={saving} className="w-full sm:w-auto">
        <Save className="mr-1.5 h-4 w-4" />
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
