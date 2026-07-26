import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  listPlatformPaymentGateways,
  upsertPlatformPaymentGateway,
} from "@/lib/store-payments.functions";
import { PAYMENT_BRANDS } from "@/components/admin/payments/providers";


export const Route = createFileRoute("/_authenticated/owner/brand-assets")({
  component: BrandAssetsPage,
});

type BrandFields = {
  logo_url: string | null;
  wordmark_url: string | null;
  brand_color: string | null;
  secondary_color: string | null;
  icon_bg_color: string | null;
  description: string | null;
  active: boolean;
  label: string;
};

function logoSrc(v: string | null | undefined) {
  if (!v) return null;
  return v.startsWith("http") ? v : `/api/img/${v}`;
}

function BrandPreview({ label, brand, logo }: { label: string; brand: BrandFields; logo: string | null }) {
  const src = logoSrc(logo);
  const bg = brand.icon_bg_color || "#ffffff";
  const color = brand.brand_color || "#64748B";
  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-xl border p-2 sm:gap-3 sm:p-3"
      style={{ borderColor: color + "40", background: (brand.secondary_color || color) + "0D" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm sm:h-10 sm:w-10 md:h-12 md:w-12"
        style={{ background: bg, borderColor: color + "33" }}
      >
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-xs font-bold sm:text-sm" style={{ color }}>
            {label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold md:text-base" style={{ color }}>{label}</div>
        <div className="truncate text-[10px] text-muted-foreground sm:text-xs">
          {brand.description || "No description set"}
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const v = value || "#000000";
  return (
    <div className="space-y-1 sm:space-y-1.5">
      <Label className="text-[11px] sm:text-xs">{label}</Label>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <input
          type="color"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent sm:h-9 sm:w-12"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className="h-8 font-mono text-[11px] sm:h-9 sm:text-xs"
        />
      </div>
    </div>
  );
}

function BrandCard({
  title,
  subtitle,
  kind,
  code,
  initial,
  onSave,
}: {
  title: string;
  subtitle?: string;
  kind: "payment" | "courier";
  code: string;
  initial: BrandFields;
  onSave: (b: BrandFields) => Promise<void>;
}) {
  const [f, setF] = useState<BrandFields>(initial);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setF(initial), [initial]);

  async function handleLogo(file: File, variant: "icon" | "wordmark") {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    const setBusy = variant === "icon" ? setUploadingIcon : setUploadingWord;
    setBusy(true);
    try {
      const toUpload =
        file.type === "image/svg+xml"
          ? file
          : await compressImage(file, {
              maxEdge: variant === "wordmark" ? 800 : 512,
              quality: 0.92,
            });
      const ext = (toUpload.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
      const safeCode = code.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand";
      const path = `brand-logos/${kind}/${safeCode}-${variant}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, toUpload, {
        upsert: true,
        contentType: toUpload.type,
      });
      if (error) throw new Error(error.message);
      setF((s) => (variant === "icon" ? { ...s, logo_url: path } : { ...s, wordmark_url: path }));
      toast.success(variant === "icon" ? "Icon logo uploaded" : "Name logo uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(f);
      toast.success(`${title} branding saved`);
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const wordSrc = logoSrc(f.wordmark_url);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-2.5 sm:space-y-4 sm:p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold md:text-base">{title}</div>
          {subtitle && <div className="truncate text-[10px] text-muted-foreground sm:text-xs">{subtitle}</div>}
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[10px] sm:text-xs">
          <span className="hidden text-muted-foreground xs:inline sm:inline">{f.active ? "Active" : "Inactive"}</span>
          <Switch checked={f.active} onCheckedChange={(v) => setF((s) => ({ ...s, active: v }))} />
        </label>
      </div>

      <BrandPreview label={f.label || title} brand={f} logo={f.logo_url} />

      {wordSrc && (
        <div
          className="flex items-center justify-center overflow-hidden rounded-lg border p-2"
          style={{ background: (f.icon_bg_color || "#ffffff") }}
        >
          <img src={wordSrc} alt={`${f.label} wordmark`} className="max-h-10 w-auto object-contain sm:max-h-12" />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
          <Label className="text-[11px] sm:text-xs">Brand name</Label>
          <Input value={f.label ?? ""} onChange={(e) => setF({ ...f, label: e.target.value })} className="h-8 text-xs sm:h-9 sm:text-sm" />
        </div>

        <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
          <Label className="text-[11px] sm:text-xs">Icon logo (square — SVG / PNG / WebP)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] hover:bg-muted sm:px-3 sm:py-2 sm:text-xs">
              {uploadingIcon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadingIcon ? "Uploading…" : f.logo_url ? "Replace icon" : "Upload icon"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0], "icon")}
              />
            </label>
            {f.logo_url && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs" onClick={() => setF({ ...f, logo_url: null })}>
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
          <Label className="text-[11px] sm:text-xs">Name logo (wordmark — SVG / PNG / WebP)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] hover:bg-muted sm:px-3 sm:py-2 sm:text-xs">
              {uploadingWord ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadingWord ? "Uploading…" : f.wordmark_url ? "Replace name logo" : "Upload name logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0], "wordmark")}
              />
            </label>
            {f.wordmark_url && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs" onClick={() => setF({ ...f, wordmark_url: null })}>
                Remove
              </Button>
            )}
          </div>
        </div>

        <ColorInput label="Brand color" value={f.brand_color} onChange={(v) => setF({ ...f, brand_color: v })} />
        <ColorInput label="Secondary color" value={f.secondary_color} onChange={(v) => setF({ ...f, secondary_color: v })} />
        <ColorInput label="Icon background" value={f.icon_bg_color} onChange={(v) => setF({ ...f, icon_bg_color: v })} />
        <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
          <Label className="text-[11px] sm:text-xs">Short description</Label>
          <Textarea
            rows={2}
            value={f.description ?? ""}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder="Shown in connection cards and configuration pages."
            className="text-xs sm:text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="sm" className="w-full text-xs sm:w-auto sm:text-sm">
          {saving ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </div>
  );
}

function PaymentGatewaysTab() {
  const list = useServerFn(listPlatformPaymentGateways);
  const upsert = useServerFn(upsertPlatformPaymentGateway);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "brandGateways"], queryFn: () => list() });

  // Merge configured DB rows with static registry, so all known gateways always appear.
  const rows = useMemo(() => {
    const byId = new Map<string, any>();
    for (const row of data as any[]) byId.set(row.id, row);
    const staticIds = Object.keys(PAYMENT_BRANDS);
    const all = new Set<string>([...staticIds, ...Array.from(byId.keys())]);
    return Array.from(all).map((id) => {
      const row = byId.get(id);
      const staticBrand = PAYMENT_BRANDS[id];
      return {
        id,
        label: row?.label ?? staticBrand?.label ?? id,
        sort_order: row?.sort_order ?? 100,
        logo_url: row?.logo_url ?? null,
        brand_color: row?.brand_color ?? staticBrand?.brandColor ?? null,
        secondary_color: row?.secondary_color ?? null,
        icon_bg_color: row?.icon_bg_color ?? staticBrand?.accentColor ?? null,
        description: row?.description ?? staticBrand?.tagline ?? null,
        enabled: row?.enabled ?? false,
        methods: row?.methods ?? [],
      };
    });
  }, [data]);

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <BrandCard
          key={r.id}
          title={r.label}
          subtitle={r.id}
          kind="payment"
          code={r.id}
          initial={{
            logo_url: r.logo_url,
            brand_color: r.brand_color,
            secondary_color: r.secondary_color,
            icon_bg_color: r.icon_bg_color,
            description: r.description,
            active: r.enabled,
            label: r.label,
          }}
          onSave={async (b) => {
            await upsert({
              data: {
                providerId: r.id as any,
                label: b.label || r.label,
                sort_order: r.sort_order,
                logo_url: b.logo_url,
                brand_color: b.brand_color,
                secondary_color: b.secondary_color,
                icon_bg_color: b.icon_bg_color,
                description: b.description,
                enabled: b.active,
              },
            });
            qc.invalidateQueries({ queryKey: ["owner", "brandGateways"] });
            qc.invalidateQueries({ queryKey: ["public-payment-gateways"] });
          }}
        />
      ))}
    </div>
  );
}

function BrandAssetsPage() {
  return (
    <div>
      <OwnerPageHeader
        title="Payment Gateway Brand Assets"
        description="Central branding for every payment gateway. Courier branding lives in Courier Brand Assets."
      />
      <PaymentGatewaysTab />
    </div>
  );
}

