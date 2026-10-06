import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getTrackingSetups, saveTrackingSetup } from "@/lib/marketing.functions";
import { GOOGLE_TAG_RE, trackingDefaults, type TrackingPlatform } from "@/lib/marketing.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/marketing/ui";

const PLATFORM_LABEL: Record<TrackingPlatform, string> = {
  facebook: "Facebook",
  google: "Google",
  tiktok: "TikTok",
};

type Form = Record<string, any>;

export function TrackingSetup({ platform }: { platform: TrackingPlatform }) {
  const fetchSetups = useServerFn(getTrackingSetups);
  const save = useServerFn(saveTrackingSetup);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "tracking-setups"], queryFn: () => fetchSetups() });

  const [target, setTarget] = useState("main");
  const [form, setForm] = useState<Form>({ ...(trackingDefaults as any)[platform] });
  const [saving, setSaving] = useState(false);

  const pages = data?.pages ?? [];
  const saved = useMemo(() => {
    const t = (data?.targets ?? {})[target] ?? {};
    return (t as any)[platform] ?? null;
  }, [data, target, platform]);

  useEffect(() => {
    setForm({ ...(trackingDefaults as any)[platform], ...(saved ?? {}) });
  }, [saved, platform, target]);

  // If the selected landing page disappears, fall back to Main Store.
  useEffect(() => {
    if (target !== "main" && data && !pages.some((p: any) => p.id === target)) setTarget("main");
  }, [data, pages, target]);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const errors: Record<string, string | undefined> = {};
  if (platform === "facebook" && form.pixel_id && !/^\d{15,17}$/.test(String(form.pixel_id).trim())) {
    errors.pixel_id = "Pixel ID must be 15–17 digits";
  }
  if (platform === "google" && form.tag_id && !GOOGLE_TAG_RE.test(String(form.tag_id).trim())) {
    errors.tag_id = "Use a G-, AW- or GT- tag ID";
  }
  if (platform === "tiktok" && form.pixel_id && !/^[A-Z0-9]{10,30}$/i.test(String(form.pixel_id).trim())) {
    errors.pixel_id = "TikTok Pixel ID looks invalid";
  }
  const hasError = Object.values(errors).some(Boolean);

  const configured =
    platform === "google" ? !!String(form.tag_id ?? "").trim() : !!String(form.pixel_id ?? "").trim();
  const status = !configured ? "not_configured" : form.active ? "connected" : "error";
  const statusLabel = !configured ? "Not configured" : form.active ? "Active" : "Inactive";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError) return;
    setSaving(true);
    try {
      const config: Record<string, any> = { active: !!form.active };
      if (platform === "facebook") {
        config.pixel_id = String(form.pixel_id ?? "").trim();
        config.capi_token = String(form.capi_token ?? "").trim();
        config.test_event_code = String(form.test_event_code ?? "").trim();
      } else if (platform === "google") {
        config.tag_id = String(form.tag_id ?? "").trim();
      } else {
        config.pixel_id = String(form.pixel_id ?? "").trim();
        config.access_token = String(form.access_token ?? "").trim();
      }
      await save({ data: { target, platform, config } as any });
      await qc.invalidateQueries({ queryKey: ["admin", "tracking-setups"] });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("Tracking setup saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Tracking Setup</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One setup per platform for your store and for each landing page.
          </p>
        </div>
        <StatusBadge kind={status as any} label={statusLabel} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Target</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Main Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Main Store</SelectItem>
            {pages.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title || p.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <div className="text-sm font-medium">{PLATFORM_LABEL[platform]}</div>
        <div className="text-xs text-muted-foreground">This target is isolated to {PLATFORM_LABEL[platform]}.</div>
      </div>

      {platform === "facebook" && (
        <div className="space-y-3">
          <Field label="Pixel ID" error={errors.pixel_id}>
            <Input value={form.pixel_id ?? ""} onChange={(e) => set("pixel_id", e.target.value)} placeholder="1234567890123456" inputMode="numeric" />
          </Field>
          <Field label="Conversions API Access Token">
            <Input type="password" value={form.capi_token ?? ""} onChange={(e) => set("capi_token", e.target.value)} placeholder="EAAG…" />
          </Field>
          <Field label="Test Event Code">
            <Input value={form.test_event_code ?? ""} onChange={(e) => set("test_event_code", e.target.value)} placeholder="TEST12345" />
          </Field>
        </div>
      )}

      {platform === "google" && (
        <div className="space-y-3">
          <Field label="Google Tag ID / GA4 Measurement ID" error={errors.tag_id}>
            <Input value={form.tag_id ?? ""} onChange={(e) => set("tag_id", e.target.value)} placeholder="G-XXXXXXXXXX" />
          </Field>
        </div>
      )}

      {platform === "tiktok" && (
        <div className="space-y-3">
          <Field label="Pixel ID" error={errors.pixel_id}>
            <Input value={form.pixel_id ?? ""} onChange={(e) => set("pixel_id", e.target.value)} placeholder="CXXXXXXXXXXXXXXXXX" />
          </Field>
          <Field label="Access Token">
            <Input type="password" value={form.access_token ?? ""} onChange={(e) => set("access_token", e.target.value)} />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div>
          <Label className="text-sm">Status</Label>
          <p className="text-xs text-muted-foreground">{form.active ? "Active" : "Inactive"}</p>
        </div>
        <Switch checked={!!form.active} onCheckedChange={(v) => set("active", v)} />
      </div>

      <Button type="submit" disabled={saving || hasError} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save Tracking Setup"}
      </Button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
