import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Palette, Truck, Wallet, Upload, Loader2 } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  listPlatformPaymentGateways,
  upsertPlatformPaymentGateway,
} from "@/lib/store-payments.functions";
import { listCouriers, upsertCourier } from "@/lib/owner-ext.functions";
import { PAYMENT_BRANDS } from "@/components/admin/payments/providers";

export const Route = createFileRoute("/_authenticated/owner/brand-assets")({
  component: BrandAssetsPage,
});

type BrandFields = {
  logo_url: string | null;
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
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: color + "40", background: (brand.secondary_color || color) + "0D" }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm"
        style={{ background: bg, borderColor: color + "33" }}
      >
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-sm font-bold" style={{ color }}>
            {label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold" style={{ color }}>{label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {brand.description || "No description set"}
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const v = value || "#000000";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className="font-mono text-xs"
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setF(initial), [initial]);

  async function handleLogo(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    setUploading(true);
    try {
      const toUpload = file.type === "image/svg+xml" ? file : await compressImage(file, { maxEdge: 512, quality: 0.92 });
      const ext = (toUpload.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
      const safeCode = code.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand";
      const path = `brand-logos/${kind}/${safeCode}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, toUpload, {
        upsert: true,
        contentType: toUpload.type,
      });
      if (error) throw new Error(error.message);
      setF((s) => ({ ...s, logo_url: path }));
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
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

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{f.active ? "Active" : "Inactive"}</span>
          <Switch checked={f.active} onCheckedChange={(v) => setF((s) => ({ ...s, active: v }))} />
        </label>
      </div>

      <BrandPreview label={f.label || title} brand={f} logo={f.logo_url} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Brand name</Label>
          <Input value={f.label ?? ""} onChange={(e) => setF({ ...f, label: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Logo (SVG / PNG / WebP)</Label>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])}
              />
            </label>
            {f.logo_url && (
              <Button variant="ghost" size="sm" onClick={() => setF({ ...f, logo_url: null })}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <ColorInput label="Brand color" value={f.brand_color} onChange={(v) => setF({ ...f, brand_color: v })} />
        <ColorInput label="Secondary color" value={f.secondary_color} onChange={(v) => setF({ ...f, secondary_color: v })} />
        <ColorInput label="Icon background" value={f.icon_bg_color} onChange={(v) => setF({ ...f, icon_bg_color: v })} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Short description</Label>
          <Textarea
            rows={2}
            value={f.description ?? ""}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder="Shown in connection cards and configuration pages."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="sm">
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
    <div className="grid gap-4 md:grid-cols-2">
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

function CouriersTab() {
  const list = useServerFn(listCouriers);
  const upsert = useServerFn(upsertCourier);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "brandCouriers"], queryFn: () => list() });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(data as any[]).map((r) => (
        <BrandCard
          key={r.id}
          title={r.name}
          subtitle={r.code}
          kind="courier"
          code={r.code}
          initial={{
            logo_url: r.logo_url ?? null,
            brand_color: r.brand_color ?? null,
            secondary_color: r.secondary_color ?? null,
            icon_bg_color: r.icon_bg_color ?? null,
            description: r.description ?? null,
            active: !!r.is_active,
            label: r.name,
          }}
          onSave={async (b) => {
            await upsert({
              data: {
                id: r.id,
                name: b.label || r.name,
                code: r.code,
                base_url: r.base_url,
                clear_api_key: false,
                logo_url: b.logo_url,
                is_default: !!r.is_default,
                is_active: b.active,
                brand_color: b.brand_color,
                secondary_color: b.secondary_color,
                icon_bg_color: b.icon_bg_color,
                description: b.description,
                config: r.config ?? {},
              },
            });
            qc.invalidateQueries({ queryKey: ["owner", "brandCouriers"] });
            qc.invalidateQueries({ queryKey: ["courier-providers-public"] });
          }}
        />
      ))}
      {(data as any[]).length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No couriers configured yet. Add couriers from the Couriers page first, then return here to manage their branding.
        </div>
      )}
    </div>
  );
}

function BrandAssetsPage() {
  return (
    <div>
      <OwnerPageHeader
        title="Brand Assets"
        description="Central branding for every payment gateway and courier. Changes propagate to every store admin panel automatically."
      />
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments" className="gap-2">
            <Wallet className="h-4 w-4" /> Payment Gateways
          </TabsTrigger>
          <TabsTrigger value="couriers" className="gap-2">
            <Truck className="h-4 w-4" /> Couriers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <PaymentGatewaysTab />
        </TabsContent>
        <TabsContent value="couriers">
          <CouriersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
