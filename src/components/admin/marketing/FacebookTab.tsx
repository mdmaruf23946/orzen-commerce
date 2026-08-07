import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Save } from "lucide-react";
import { getFacebookStatus, sendFbTestEvent } from "@/lib/admin.functions";
import { updateMarketingFacebook } from "@/lib/marketing.functions";
import { facebookDefaults } from "@/lib/marketing.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Row, StatusBadge, TestResult, AUTO_EVENTS, type StatusKind } from "./ui";
import { useMarketingForm } from "./useMarketingForm";

export function FacebookTab() {
  const { form, set, saving, submit } = useMarketingForm(null, facebookDefaults, updateMarketingFacebook);
  const qc = useQueryClient();
  const getStatus = useServerFn(getFacebookStatus);
  const sendTest = useServerFn(sendFbTestEvent);
  const { data: status } = useQuery({ queryKey: ["fb", "status"], queryFn: () => getStatus() });
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const pixelInvalid = !!form.fb_pixel_id && !/^\d{15,17}$/.test(form.fb_pixel_id);
  const codeInvalid = !!form.fb_test_event_code && !/^[A-Za-z0-9_-]{4,40}$/.test(form.fb_test_event_code);
  const tokenShort = !!form.fb_capi_enabled && (!form.fb_capi_token || form.fb_capi_token.length < 40);

  const kind: StatusKind =
    status?.mode === "live" ? "connected" : status?.mode === "test" ? "test" : "not_configured";

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const res: any = await sendTest();
      if (res.ok) {
        const n = res.events_received ?? 0;
        setResult({ ok: true, text: `Meta received ${n} event${n === 1 ? "" : "s"} in ${String(res.mode).toUpperCase()} mode. Check Events Manager → Test Events.` });
        toast.success("Test event sent");
      } else {
        setResult({ ok: false, text: res.error ?? "Failed" });
        toast.error(res.error ?? "Failed");
      }
      qc.invalidateQueries({ queryKey: ["fb", "status"] });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Facebook / Meta Tracking"
        description="Browser Pixel + server-side Conversions API with automatic deduplication."
        status={<StatusBadge kind={kind} label={status?.mode === "live" ? "Live" : undefined} />}
      >
        <Row
          label="Facebook Pixel ID"
          checked={form.fb_pixel_enabled !== false}
          onCheckedChange={(v) => set("fb_pixel_enabled", v)}
          error={pixelInvalid && "Pixel ID must be 15–17 digits."}
        >
          <Input
            value={form.fb_pixel_id ?? ""}
            onChange={(e) => set("fb_pixel_id", e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 1234567890123456"
            inputMode="numeric"
          />
        </Row>

        <Row
          label="Conversions API — Access Token"
          checked={!!form.fb_capi_enabled}
          onCheckedChange={(v) => set("fb_capi_enabled", v)}
          hint="Generate from Events Manager → Data Sources → Settings → Conversions API."
          error={tokenShort && "CAPI token looks too short."}
        >
          <Input
            type="password"
            value={form.fb_capi_token ?? ""}
            onChange={(e) => set("fb_capi_token", e.target.value)}
            placeholder="EAAB…"
            autoComplete="off"
          />
        </Row>

        <Row
          label="Test Event Code (optional)"
          hint="When set, all events go to Meta Test Events. Leave empty for Live mode."
          error={codeInvalid && "Invalid test event code."}
        >
          <Input
            value={form.fb_test_event_code ?? ""}
            onChange={(e) => set("fb_test_event_code", e.target.value.trim())}
            placeholder="TEST12345"
          />
        </Row>

        <TestResult result={result} />

        <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <div className="font-medium text-foreground">Auto-tracked events</div>
          {AUTO_EVENTS}. Each event fires on the browser and on the server with a shared{" "}
          <code>event_id</code> so Meta deduplicates.
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => submit()} disabled={saving} className="w-full sm:w-auto">
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={runTest}
          disabled={testing || !status?.pixel_id || !status?.capi_enabled}
          className="w-full sm:w-auto"
        >
          <FlaskConical className="mr-1.5 h-4 w-4" />
          {testing ? "Sending…" : "Test Event"}
        </Button>
      </div>
    </div>
  );
}
