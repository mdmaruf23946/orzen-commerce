import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Save } from "lucide-react";
import { updateMarketingTiktok, getTiktokStatus, sendTiktokTestEvent } from "@/lib/marketing.functions";
import { tiktokDefaults, TT_PIXEL_RE } from "@/lib/marketing.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Row, StatusBadge, TestResult, AUTO_EVENTS, type StatusKind } from "./ui";
import { useMarketingForm } from "./useMarketingForm";

export function TiktokTab() {
  const { form, set, saving, submit } = useMarketingForm("tiktok", tiktokDefaults, updateMarketingTiktok);
  const qc = useQueryClient();
  const getStatus = useServerFn(getTiktokStatus);
  const sendTest = useServerFn(sendTiktokTestEvent);
  const { data: status } = useQuery({ queryKey: ["tiktok", "status"], queryFn: () => getStatus() });
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const pixelInvalid = !!form.pixel_id && !TT_PIXEL_RE.test(form.pixel_id);
  const pixelKind: StatusKind = !status?.pixel.configured ? "not_configured" : status.pixel.enabled ? "connected" : "not_configured";
  const apiKind: StatusKind =
    !status?.events_api.configured ? "not_configured" : status.mode === "test" ? "test" : status.events_api.enabled ? "connected" : "not_configured";

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const res: any = await sendTest();
      if (res.ok) {
        setResult({ ok: true, text: `TikTok accepted the event in ${String(res.mode).toUpperCase()} mode. Check Events Manager → Test Events.` });
        toast.success("Test event sent");
      } else {
        setResult({ ok: false, text: res.error ?? "Failed" });
        toast.error(res.error ?? "Failed");
      }
      qc.invalidateQueries({ queryKey: ["tiktok", "status"] });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="TikTok Pixel" description="Browser pixel loaded on every storefront page." status={<StatusBadge kind={pixelKind} />}>
        <Row label="Enable TikTok Pixel" checked={!!form.pixel_enabled} onCheckedChange={(v) => set("pixel_enabled", v)} />
        <Row label="Pixel ID" error={pixelInvalid && "Pixel ID looks invalid."}>
          <Input value={form.pixel_id ?? ""} onChange={(e) => set("pixel_id", e.target.value.trim())} placeholder="C8XXXXXXXXXXXXXXXXXX" />
        </Row>
      </Card>

      <Card title="TikTok Events API" description="Server-side event tracking for accurate attribution." status={<StatusBadge kind={apiKind} />}>
        <Row label="Enable Events API" checked={!!form.events_api_enabled} onCheckedChange={(v) => set("events_api_enabled", v)} />
        <Row label="Access Token" hint="TikTok Events Manager → your pixel → Settings → Generate Access Token.">
          <Input
            type="password"
            autoComplete="off"
            value={form.access_token ?? ""}
            onChange={(e) => set("access_token", e.target.value.trim())}
            placeholder="••••••••"
          />
        </Row>
        <Row label="Test Event Code (optional)" hint="When set, events go to TikTok Test Events instead of Live.">
          <Input value={form.test_event_code ?? ""} onChange={(e) => set("test_event_code", e.target.value.trim())} placeholder="TEST12345" />
        </Row>
        <TestResult result={result} />
      </Card>

      <Card title="Advanced Matching" description="Hashed customer identifiers improve match quality. Values are SHA-256 hashed before sending.">
        <Row label="Enable Advanced Matching" checked={form.match_enabled !== false} onCheckedChange={(v) => set("match_enabled", v)} />
        <Row label="Email matching" checked={form.match_email !== false} onCheckedChange={(v) => set("match_email", v)} />
        <Row label="Phone matching" checked={form.match_phone !== false} onCheckedChange={(v) => set("match_phone", v)} />
        <Row label="External ID matching" checked={form.match_external_id !== false} onCheckedChange={(v) => set("match_external_id", v)} />
      </Card>

      <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <div className="font-medium text-foreground">Auto-tracked events &amp; deduplication</div>
        {AUTO_EVENTS}. Browser and server events share one <code>event_id</code>, so TikTok removes duplicates automatically.
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => submit()} disabled={saving} className="w-full sm:w-auto">
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={runTest}
          disabled={testing || !status?.events_api.configured}
          className="w-full sm:w-auto"
        >
          <FlaskConical className="mr-1.5 h-4 w-4" />
          {testing ? "Sending…" : "Send Test Event"}
        </Button>
      </div>
    </div>
  );
}
