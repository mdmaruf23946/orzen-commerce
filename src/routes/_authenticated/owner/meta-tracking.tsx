import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPlatformTracking, savePlatformTracking, sendPlatformTestEvent } from "@/lib/platform-meta.functions";

export const Route = createFileRoute("/_authenticated/owner/meta-tracking")({ component: Page });

const EVENTS: { key: string; label: string }[] = [
  { key: "PageView", label: "Page visit" },
  { key: "ViewContent", label: "Plans / pricing viewed" },
  { key: "CompleteRegistration", label: "Sign-up completed" },
  { key: "Lead", label: "Store created" },
  { key: "StartTrial", label: "Trial started" },
  { key: "InitiateCheckout", label: "Plan checkout opened" },
  { key: "AddPaymentInfo", label: "Went to payment gateway" },
  { key: "Purchase", label: "Payment verified (Purchase)" },
  { key: "Subscribe", label: "Plan activated after payment" },
  { key: "WalletTopup", label: "Wallet top-up verified" },
];

function Page() {
  const get = useServerFn(getPlatformTracking);
  const save = useServerFn(savePlatformTracking);
  const test = useServerFn(sendPlatformTestEvent);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "meta-tracking"], queryFn: () => get() });
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form)
      setForm({
        enabled: !!data.enabled,
        pixel_enabled: data.pixel_enabled !== false,
        capi_enabled: data.capi_enabled !== false,
        pixel_id: data.pixel_id ?? "",
        capi_token: "",
        test_event_code: data.test_event_code ?? "",
        send_user_data: data.send_user_data !== false,
        events: data.events ?? {},
      });
  }, [data, form]);

  if (!form) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function onSave(clear_token = false) {
    setBusy(true);
    try {
      await save({ data: { ...form, capi_token: form.capi_token || undefined, clear_token } });
      toast.success("Saved");
      setForm((f: any) => ({ ...f, capi_token: "" }));
      qc.invalidateQueries({ queryKey: ["owner", "meta-tracking"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function onTest() {
    setBusy(true);
    try {
      const r: any = await test();
      r.ok ? toast.success(r.message) : toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["owner", "meta-tracking"] });
    } finally {
      setBusy(false);
    }
  }

  const Row = ({ k, label, hint }: { k: string; label: string; hint?: string }) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={!!form[k]} onCheckedChange={(v) => set(k, v)} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <OwnerPageHeader
        title="Main Website Tracking"
        description="Meta Pixel + Conversions API for the ORZEN website only. Merchant store pixels are separate and are not affected."
      />

      <section className="rounded-xl border bg-card p-5">
        <Row k="enabled" label="Tracking on" hint="Master switch for the whole main website." />
        <Row k="pixel_enabled" label="Browser Pixel" />
        <Row k="capi_enabled" label="Server Conversions API" hint="Works even when ad blockers stop the browser pixel." />
        <Row k="send_user_data" label="Send hashed email for better matching" hint="Only for visitors who allowed tracking." />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-1.5">
          <Label>Meta Pixel ID</Label>
          <Input value={form.pixel_id} inputMode="numeric" placeholder="e.g. 123456789012345" onChange={(e) => set("pixel_id", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="space-y-1.5">
          <Label>Conversions API access token</Label>
          <Input
            type="password"
            value={form.capi_token}
            placeholder={data?.has_token ? "Saved — type a new one to replace" : "Paste token from Events Manager"}
            onChange={(e) => set("capi_token", e.target.value)}
          />
          {data?.has_token && (
            <button type="button" className="text-xs text-destructive underline" onClick={() => onSave(true)}>
              Remove saved token
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Test Event Code (optional)</Label>
          <Input value={form.test_event_code} placeholder="TEST12345" onChange={(e) => set("test_event_code", e.target.value)} />
          <p className="text-xs text-muted-foreground">While filled, all server events go to Meta “Test Events”. Clear it to go live.</p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-2 text-sm font-semibold">Events</div>
        {EVENTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between py-1.5">
            <span className="text-sm">{e.label} <span className="text-xs text-muted-foreground">({e.key})</span></span>
            <Switch checked={form.events[e.key] !== false} onCheckedChange={(v) => set("events", { ...form.events, [e.key]: v })} />
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onSave()} disabled={busy}>Save</Button>
        <Button variant="outline" onClick={onTest} disabled={busy}>Send test event</Button>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-2 text-sm font-semibold">Recent events</div>
        {!data?.log?.length ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="divide-y text-sm">
            {data.log.map((l: any) => (
              <div key={`${l.event_name}-${l.event_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{l.event_name}{l.test_mode ? " (test)" : ""}</span>
                <span className="text-xs text-muted-foreground">{l.source} · {new Date(l.created_at).toLocaleString()}</span>
                <span className={l.status === "sent" ? "text-xs text-primary" : "text-xs text-destructive"}>
                  {l.status}{l.error ? `: ${l.error}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
