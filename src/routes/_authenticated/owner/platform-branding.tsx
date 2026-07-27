import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  getPlatformBranding,
  publishPlatformBranding,
  resetPlatformBrandingPlacement,
  updatePlatformBranding,
  type BrandingAsset,
  type PlatformBranding,
} from "@/lib/platform-branding.functions";
import {
  PLACEMENT_KEYS,
  PLACEMENT_LABELS,
  type PlacementKey,
} from "@/lib/platform-branding";

export const Route = createFileRoute("/_authenticated/owner/platform-branding")({
  component: PlatformBrandingPage,
});

const LOGO_KEYS = [
  ["primaryLogo", "Primary Logo"],
  ["compactLogo", "Compact Logo"],
  ["squareLogo", "Square Logo"],
  ["lightLogo", "Light Logo"],
  ["darkLogo", "Dark Logo"],
] as const;

const WORDMARK_KEYS = [
  ["primaryWordmark", "Primary Wordmark"],
  ["lightWordmark", "Light Wordmark"],
  ["darkWordmark", "Dark Wordmark"],
  ["compactWordmark", "Compact Wordmark"],
] as const;

const ICON_KEYS = [
  ["favicon", "Favicon (32×32 / SVG / ICO)"],
  ["appIcon192", "App Icon 192×192"],
  ["appIcon512", "App Icon 512×512"],
] as const;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_ICON_BYTES = 512 * 1024;

function AssetUploader({
  slot,
  label,
  value,
  onChange,
  bucketPath,
  maxBytes,
  accept = "image/*",
}: {
  slot: string;
  label: string;
  value: BrandingAsset;
  onChange: (v: BrandingAsset) => void;
  bucketPath: string;
  maxBytes: number;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const src = value?.url ?? null;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "image/vnd.microsoft.icon") {
      return toast.error("Please choose an image file");
    }
    if (file.size > maxBytes) {
      return toast.error(`File is too large (max ${Math.round(maxBytes / 1024)} KB)`);
    }
    setBusy(true);
    try {
      const toUpload =
        file.type === "image/svg+xml" || file.type === "image/vnd.microsoft.icon"
          ? file
          : await compressImage(file, { maxEdge: 1024, quality: 0.92 });
      const ext =
        (toUpload.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
      const safe = slot.toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `platform-branding/${bucketPath}/${safe}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(path, toUpload, { upsert: true, contentType: toUpload.type });
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
      onChange({
        url: pub.publicUrl,
        mime: toUpload.type || null,
        size: toUpload.size,
      });
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2.5 sm:p-3">
      <Label className="text-[11px] sm:text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {src ? (
            <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Empty</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] hover:bg-muted sm:text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? "Uploading…" : src ? "Replace" : "Upload"}
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {src && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LivePreview({ b }: { b: PlatformBranding }) {
  const logo = b.assets?.primaryLogo?.url ?? b.assets?.lightLogo?.url ?? b.assets?.compactLogo?.url;
  const wordmark = b.assets?.primaryWordmark?.url;
  const combo = b.combo;

  const flex = combo?.layout === "top" ? "flex-col" : "flex-row";
  const justify =
    combo?.align === "center" ? "justify-center" : combo?.align === "end" ? "justify-end" : "justify-start";

  const Mark = () => (
    <span className={`inline-flex items-center ${flex} ${justify}`} style={{ gap: combo?.gap ?? 8 }}>
      {(combo?.mode === "logo" || combo?.mode === "both") && logo && (
        <img src={logo} alt="" style={{ height: combo?.logoSize ?? 32 }} className="w-auto object-contain" />
      )}
      {(combo?.mode === "wordmark" || combo?.mode === "both") && wordmark && (
        <img src={wordmark} alt="brand" style={{ height: combo?.wordmarkSize ?? 24 }} className="w-auto object-contain" />
      )}
      {!logo && !wordmark && <span className="text-sm font-semibold text-muted-foreground">Your brand</span>}
    </span>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-2 text-[10px] uppercase text-muted-foreground">Desktop header</div>
        <div className="flex h-12 items-center border-b px-3"><Mark /></div>
      </div>
      <div className="rounded-xl border bg-slate-900 p-3 text-white shadow-sm">
        <div className="mb-2 text-[10px] uppercase text-slate-400">Dark header</div>
        <div className="flex h-12 items-center border-b border-slate-700 px-3"><Mark /></div>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm sm:col-span-2">
        <div className="mb-2 text-[10px] uppercase text-muted-foreground">Login screen</div>
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg bg-muted/30">
          <Mark />
          <div className="text-xs text-muted-foreground">Sign in to continue</div>
        </div>
      </div>
    </div>
  );
}

function PlacementCard({
  keyName,
  value,
  onChange,
}: {
  keyName: PlacementKey;
  value: any;
  onChange: (v: any) => void;
}) {
  const v = value ?? { source: "global", visible: true };
  const isCustom = v.source === "custom";
  return (
    <div className="space-y-2 rounded-lg border bg-card p-2.5 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs font-semibold sm:text-sm">{PLACEMENT_LABELS[keyName]}</div>
        <label className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">{v.visible === false ? "Hidden" : "Visible"}</span>
          <Switch
            checked={v.visible !== false}
            onCheckedChange={(x) => onChange({ ...v, visible: x })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={!isCustom}
            onChange={() => onChange({ ...v, source: "global" })}
          />
          Use global
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={isCustom}
            onChange={() => onChange({ ...v, source: "custom" })}
          />
          Use custom
        </label>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["logo", "wordmark", "both"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...v, mode: m })}
            className={`rounded-md border px-2 py-1 text-[11px] ${
              (v.mode ?? "both") === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlatformBrandingPage() {
  const get = useServerFn(getPlatformBranding);
  const save = useServerFn(updatePlatformBranding);
  const publish = useServerFn(publishPlatformBranding);
  const resetOne = useServerFn(resetPlatformBrandingPlacement);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "platformBranding"], queryFn: () => get() });

  const [assets, setAssets] = useState<Record<string, BrandingAsset>>({});
  const [combo, setCombo] = useState<PlatformBranding["combo"]>({});
  const [placements, setPlacements] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAssets(data.assets ?? {});
    setCombo(data.combo ?? {});
    setPlacements(data.placements ?? {});
  }, [data]);

  const previewBranding = useMemo<PlatformBranding>(
    () => ({ assets, combo, placements, published_at: null, updated_at: null }),
    [assets, combo, placements],
  );

  async function doSave() {
    setSaving(true);
    try {
      await save({ data: { assets, combo, placements } });
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: ["owner", "platformBranding"] });
      qc.invalidateQueries({ queryKey: ["platform-branding"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function doPublish() {
    setPublishing(true);
    try {
      await save({ data: { assets, combo, placements } });
      await publish();
      toast.success("Branding published");
      qc.invalidateQueries({ queryKey: ["owner", "platformBranding"] });
      qc.invalidateQueries({ queryKey: ["platform-branding"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <OwnerPageHeader
        title="Platform Branding"
        description="Central control for the platform's logo, wordmark, favicon, and per-location branding. Existing pages keep their current branding until you publish."
      />

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold sm:text-base">Global Brand Logo</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LOGO_KEYS.map(([k, label]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              value={assets[k] ?? null}
              onChange={(v) => setAssets((s) => ({ ...s, [k]: v }))}
              bucketPath="logos"
              maxBytes={MAX_LOGO_BYTES}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold sm:text-base">Brand Name / Wordmark</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WORDMARK_KEYS.map(([k, label]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              value={assets[k] ?? null}
              onChange={(v) => setAssets((s) => ({ ...s, [k]: v }))}
              bucketPath="wordmarks"
              maxBytes={MAX_LOGO_BYTES}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold sm:text-base">Logo + Wordmark combination</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Mode</Label>
            <select
              value={combo.mode ?? "both"}
              onChange={(e) => setCombo({ ...combo, mode: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="logo">Logo only</option>
              <option value="wordmark">Wordmark only</option>
              <option value="both">Logo + Wordmark</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Layout</Label>
            <select
              value={combo.layout ?? "left"}
              onChange={(e) => setCombo({ ...combo, layout: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="left">Logo left + wordmark right</option>
              <option value="top">Logo on top + wordmark below</option>
              <option value="centered">Centered</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Alignment</Label>
            <select
              value={combo.align ?? "start"}
              onChange={(e) => setCombo({ ...combo, align: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Gap ({combo.gap ?? 8}px)</Label>
            <Input
              type="number"
              min={0}
              max={96}
              value={combo.gap ?? 8}
              onChange={(e) => setCombo({ ...combo, gap: Number(e.target.value) || 0 })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Logo size ({combo.logoSize ?? 32}px)</Label>
            <Input
              type="number"
              min={8}
              max={256}
              value={combo.logoSize ?? 32}
              onChange={(e) => setCombo({ ...combo, logoSize: Number(e.target.value) || 32 })}
              className="h-9 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Wordmark size ({combo.wordmarkSize ?? 24}px)</Label>
            <Input
              type="number"
              min={8}
              max={256}
              value={combo.wordmarkSize ?? 24}
              onChange={(e) => setCombo({ ...combo, wordmarkSize: Number(e.target.value) || 24 })}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold sm:text-base">Favicon &amp; App Icon</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ICON_KEYS.map(([k, label]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              value={assets[k] ?? null}
              onChange={(v) => setAssets((s) => ({ ...s, [k]: v }))}
              bucketPath="icons"
              maxBytes={MAX_ICON_BYTES}
              accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold sm:text-base">Live preview</h2>
        </div>
        <LivePreview b={previewBranding} />
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold sm:text-base">Placement manager</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEMENT_KEYS.map((k) => (
            <PlacementCard
              key={k}
              keyName={k}
              value={placements[k]}
              onChange={(v) => setPlacements((s) => ({ ...s, [k]: v }))}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Any placement left on "Use global" inherits the global logo + wordmark. Reset a placement to
          clear its override.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(placements).map((k) => (
            <Button
              key={k}
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={async () => {
                await resetOne({ data: { key: k } });
                setPlacements((s) => {
                  const n = { ...s };
                  delete n[k];
                  return n;
                });
                toast.success("Placement reset");
              }}
            >
              Reset {PLACEMENT_LABELS[k as PlacementKey] ?? k}
            </Button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button variant="outline" onClick={doSave} disabled={saving || publishing}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button onClick={doPublish} disabled={saving || publishing}>
          {publishing ? "Publishing…" : "Publish branding"}
        </Button>
      </div>
    </div>
  );
}
