import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Store, FileText, Save, Unplug, X } from "lucide-react";
import { getTrackingSetups, saveTrackingSetup } from "@/lib/marketing.functions";
import { GOOGLE_TAG_RE, trackingDefaults, type TrackingPlatform } from "@/lib/marketing.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/marketing/ui";

type Form = Record<string, any>;

const idKey = (p: TrackingPlatform) => (p === "google" ? "tag_id" : "pixel_id");

/**
 * Single connection manager: one editor, one target at a time.
 * "main" renders the primary store integration (passed in); landing pages use their own isolated setup.
 */
export function TrackingSetup({ platform, mainEditor }: { platform: TrackingPlatform; mainEditor: React.ReactNode }) {
  const fetchSetups = useServerFn(getTrackingSetups);
  const { data } = useQuery({ queryKey: ["admin", "tracking-setups"], queryFn: () => fetchSetups() });
  const pages: any[] = data?.pages ?? [];
  const targets: Record<string, any> = data?.targets ?? {};

  const connectedPages = useMemo(
    () => pages.filter((p) => {
      const c = targets[p.id]?.[platform];
      return c && c.active && String(c[idKey(platform)] ?? "").trim();
    }),
    [pages, targets, platform],
  );

  const [selected, setSelected] = useState("main");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const listed = [...connectedPages, ...pages.filter((p) => drafts.includes(p.id) && !connectedPages.some((c) => c.id === p.id))];
  const available = pages.filter((p) => !listed.some((l) => l.id === p.id));

  function create(target: string) {
    if (target === "main") { setSelected("main"); setCreating(false); return; }
    setDrafts((d) => [...d, target]);
    setSelected(target);
    setCreating(false);
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Connections</h2>
            <p className="text-xs text-muted-foreground">Choose what you are setting up: the Store or a Landing Page.</p>
          </div>
          <Button type="button" size="sm" onClick={() => setCreating((v) => !v)} disabled={!creating && available.length === 0}>
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {creating ? "Cancel" : "New Connection"}
          </Button>
        </div>

        {creating && (
          <div className="space-y-1.5 rounded-lg border border-dashed p-3">
            <Label className="text-sm">Create connection for</Label>
            <Select onValueChange={create}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a landing page" /></SelectTrigger>
              <SelectContent>
                {available.map((p) => <SelectItem key={p.id} value={p.id}>Landing Page — {p.title || p.slug}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={selected === "main" ? "secondary" : "outline"} onClick={() => setSelected("main")}>
            <Store className="h-3.5 w-3.5" /> Main Store
          </Button>
          {listed.map((p) => (
            <Button key={p.id} type="button" size="sm" variant={selected === p.id ? "secondary" : "outline"} onClick={() => setSelected(p.id)}>
              <FileText className="h-3.5 w-3.5" /> {p.title || p.slug}
            </Button>
          ))}
        </div>
      </div>

      {selected === "main" ? mainEditor : (
        <LandingEditor
          key={selected}
          platform={platform}
          target={selected}
          title={pages.find((p) => p.id === selected)?.title ?? "Landing Page"}
          saved={targets[selected]?.[platform] ?? null}
          onRemoved={() => { setDrafts((d) => d.filter((x) => x !== selected)); setSelected("main"); }}
        />
      )}
    </div>
  );
}

function LandingEditor({ platform, target, title, saved, onRemoved }: {
  platform: TrackingPlatform; target: string; title: string; saved: any; onRemoved: () => void;
}) {
  const save = useServerFn(saveTrackingSetup);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>({ ...(trackingDefaults as any)[platform], ...(saved ?? {}) });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm({ ...(trackingDefaults as any)[platform], ...(saved ?? {}) }); }, [saved, platform]);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const errors: Record<string, string | undefined> = {};
  if (platform === "facebook" && form.pixel_id && !/^\d{15,17}$/.test(String(form.pixel_id).trim())) errors.pixel_id = "Pixel ID must be 15–17 digits";
  if (platform === "google" && form.tag_id && !GOOGLE_TAG_RE.test(String(form.tag_id).trim())) errors.tag_id = "Use a G-, AW- or GT- tag ID";
  if (platform === "tiktok" && form.pixel_id && !/^[A-Z0-9]{10,30}$/i.test(String(form.pixel_id).trim())) errors.pixel_id = "TikTok Pixel ID looks invalid";
  const hasId = !!String(form[idKey(platform)] ?? "").trim();
  const hasError = Object.values(errors).some(Boolean);
  const isConnected = !!(saved?.active && String(saved?.[idKey(platform)] ?? "").trim());

  async function persist(active: boolean) {
    setSaving(true);
    try {
      const config: Record<string, any> = { active };
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
      toast.success(active ? "Connection saved" : "Connection disconnected");
      if (!active) onRemoved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!hasError && hasId) persist(true); }} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Landing Page — {title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">This connection is used only on this landing page.</p>
        </div>
        <StatusBadge kind={isConnected ? "connected" : "not_configured"} label={isConnected ? "Connected" : "Not connected"} />
      </div>

      {platform === "facebook" && (<>
        <Field label="Pixel ID" error={errors.pixel_id}>
          <Input value={form.pixel_id ?? ""} onChange={(e) => set("pixel_id", e.target.value.replace(/\D/g, ""))} placeholder="1234567890123456" inputMode="numeric" />
        </Field>
        <Field label="Conversions API Access Token">
          <Input type="password" value={form.capi_token ?? ""} onChange={(e) => set("capi_token", e.target.value)} placeholder="EAAG…" autoComplete="off" />
        </Field>
        <Field label="Test Event Code (optional)">
          <Input value={form.test_event_code ?? ""} onChange={(e) => set("test_event_code", e.target.value.trim())} placeholder="TEST12345" />
        </Field>
      </>)}
      {platform === "google" && (
        <Field label="Google Tag ID / GA4 Measurement ID" error={errors.tag_id}>
          <Input value={form.tag_id ?? ""} onChange={(e) => set("tag_id", e.target.value)} placeholder="G-XXXXXXXXXX" />
        </Field>
      )}
      {platform === "tiktok" && (<>
        <Field label="Pixel ID" error={errors.pixel_id}>
          <Input value={form.pixel_id ?? ""} onChange={(e) => set("pixel_id", e.target.value)} placeholder="CXXXXXXXXXXXXXXXXX" />
        </Field>
        <Field label="Access Token">
          <Input type="password" value={form.access_token ?? ""} onChange={(e) => set("access_token", e.target.value)} autoComplete="off" />
        </Field>
      </>)}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={saving || hasError || !hasId} className="w-full sm:w-auto">
          <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save & Connect"}
        </Button>
        {isConnected && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => persist(false)} className="w-full sm:w-auto">
            <Unplug className="mr-1.5 h-4 w-4" /> Disconnect
          </Button>
        )}
      </div>
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
