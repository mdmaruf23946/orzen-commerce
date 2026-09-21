import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Moon, Sun, Upload } from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "প্ল্যাটফর্ম ব্র্যান্ডিং — ORZEN Winner Admin" },
      { name: "description", content: "ORZEN-এর আইকন, নাম লোগো, browser icon ও app icon পরিচালনা করুন।" },
      { property: "og:title", content: "প্ল্যাটফর্ম ব্র্যান্ডিং — ORZEN Winner Admin" },
      { property: "og:description", content: "ORZEN-এর সব জায়গার লোগো ও icon পরিচালনা করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LOGO_KEYS = [
  ["primaryLogo", "প্রধান আইকন লোগো", "সাধারণভাবে সব জায়গায় ব্যবহৃত ছোট প্রতীক।", "square"],
  ["compactLogo", "ছোট জায়গার আইকন লোগো", "কম জায়গা, ছোট হেডার বা মোবাইলের জন্য।", "square"],
  ["squareLogo", "বর্গাকার আইকন লোগো", "বর্গাকার প্রদর্শন বা প্রোফাইল ধরনের জায়গার জন্য।", "square"],
  ["lightLogo", "হালকা ব্যাকগ্রাউন্ডের আইকন লোগো", "সাদা বা হালকা অংশে দেখাবে—গাঢ় রঙের লোগো দিন।", "light"],
  ["darkLogo", "ডার্ক ব্যাকগ্রাউন্ডের আইকন লোগো", "Dark Mode বা গাঢ় অংশে দেখাবে—সাদা/হালকা লোগো দিন।", "dark"],
] as const;

const WORDMARK_KEYS = [
  ["primaryWordmark", "প্রধান নাম লোগো", "ORZEN নামসহ সাধারণ লোগো; বেশিরভাগ জায়গায় এটি ব্যবহৃত হবে।", "wide"],
  ["lightWordmark", "হালকা ব্যাকগ্রাউন্ডের নাম লোগো", "সাদা বা হালকা অংশের জন্য গাঢ় লেখার নাম লোগো।", "light"],
  ["darkWordmark", "ডার্ক ব্যাকগ্রাউন্ডের নাম লোগো", "Dark Mode-এর জন্য সাদা/হালকা লেখার স্বচ্ছ PNG বা SVG দিন।", "dark"],
  ["compactWordmark", "ছোট জায়গার নাম লোগো", "ছোট হেডার বা কম জায়গার জন্য সংক্ষিপ্ত নাম লোগো।", "wide"],
] as const;

const ICON_KEYS = [
  ["favicon", "Browser Tab Icon (Favicon)", "ব্রাউজারের ট্যাবে ওয়েবসাইটের নামের পাশে দেখাবে। 32×32 PNG, SVG বা ICO দিন।"],
  ["appIcon192", "App Icon — ছোট (192×192)", "মোবাইল Home Screen ও ছোট install icon হিসেবে ব্যবহৃত হবে।"],
  ["appIcon512", "App Icon — বড় (512×512)", "Install করা app-এর বড় ও পরিষ্কার icon হিসেবে ব্যবহৃত হবে।"],
] as const;

const PLACEMENT_HELP: Record<PlacementKey, string> = {
  winner_header: "Winner Admin Panel-এর একদম উপরের অংশে।",
  store_header: "Merchant Panel-এর একদম উপরের অংশে।",
  sidebar: "Desktop-এর বাম পাশের মেনুর উপরে।",
  mobile_header: "মোবাইলে উপরের navigation অংশে।",
  website_header: "ORZEN-এর মূল website header-এ।",
  customer_store: "Customer যে online store দেখেন সেখানে।",
  auth_login: "Account Login করার পেজে।",
  auth_register: "নতুন Account খোলার পেজে।",
  auth_forgot: "Password ভুলে গেলে reset করার পেজে।",
  footer: "Website-এর প্রত্যেক পেজের একদম নিচে।",
  checkout: "Customer-এর Checkout পেজে।",
  order_confirm: "Order সফল হওয়ার confirmation পেজে।",
  loading: "পেজ খোলার সময় Loading Screen-এ।",
  invoice: "Order Invoice বা receipt-এ।",
  email: "ORZEN থেকে পাঠানো platform email-এ।",
};

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
  helperText,
  previewTone = "default",
}: {
  slot: string;
  label: string;
  value: BrandingAsset;
  onChange: (v: BrandingAsset) => void;
  bucketPath: string;
  maxBytes: number;
  accept?: string;
  helperText?: string;
  previewTone?: "default" | "light" | "dark" | "square" | "wide";
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
      // store-assets is a private bucket — serve via the /api/img proxy
      // so the URL works for anonymous visitors (favicon, storefront, etc.).
      onChange({
        url: `/api/img/${path}`,
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
      <div>
        <Label className="text-xs font-semibold sm:text-sm">{label}</Label>
        {helperText && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{helperText}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex h-14 shrink-0 items-center justify-center overflow-hidden rounded-md border ${previewTone === "wide" ? "w-24" : "w-14"} ${previewTone === "dark" ? "bg-slate-950" : previewTone === "light" ? "bg-white" : "bg-muted/30"}`}>
          {src ? (
            <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className={`text-[10px] ${previewTone === "dark" ? "text-slate-400" : "text-muted-foreground"}`}>খালি</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] hover:bg-muted sm:text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? "আপলোড হচ্ছে…" : src ? "পরিবর্তন" : "আপলোড"}
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {src && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onChange(null)}>
              মুছুন
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LivePreview({ b }: { b: PlatformBranding }) {
  const combo = b.combo;

  const flex = combo?.layout === "top" ? "flex-col" : "flex-row";
  const justify =
    combo?.align === "center" ? "justify-center" : combo?.align === "end" ? "justify-end" : "justify-start";

  const Mark = ({ dark = false }: { dark?: boolean }) => {
    const logo = dark
      ? b.assets?.darkLogo?.url ?? b.assets?.primaryLogo?.url ?? b.assets?.compactLogo?.url
      : b.assets?.lightLogo?.url ?? b.assets?.primaryLogo?.url ?? b.assets?.compactLogo?.url;
    const wordmark = dark
      ? b.assets?.darkWordmark?.url ?? b.assets?.primaryWordmark?.url
      : b.assets?.lightWordmark?.url ?? b.assets?.primaryWordmark?.url;
    return (
    <span className={`inline-flex items-center ${flex} ${justify}`} style={{ gap: combo?.gap ?? 8 }}>
      {(combo?.mode === "logo" || combo?.mode === "both") && logo && (
        <img src={logo} alt="" style={{ height: combo?.logoSize ?? 32 }} className="w-auto object-contain" />
      )}
      {(combo?.mode === "wordmark" || combo?.mode === "both") && wordmark && (
        <img src={wordmark} alt="brand" style={{ height: combo?.wordmarkSize ?? 24 }} className="w-auto object-contain" />
      )}
      {!logo && !wordmark && <span className={dark ? "text-sm font-semibold text-slate-400" : "text-sm font-semibold text-muted-foreground"}>আপনার ব্র্যান্ড</span>}
    </span>
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Sun className="h-3.5 w-3.5" /> হালকা হেডার</div>
        <div className="flex h-12 items-center border-b px-3"><Mark /></div>
      </div>
      <div className="rounded-xl border bg-slate-900 p-3 text-white shadow-sm">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><Moon className="h-3.5 w-3.5" /> ডার্ক হেডার</div>
        <div className="flex h-12 items-center border-b border-slate-700 px-3"><Mark dark /></div>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm sm:col-span-2">
        <div className="mb-2 text-[11px] font-medium text-muted-foreground">Login Screen</div>
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg bg-muted/30">
          <Mark />
          <div className="text-xs text-muted-foreground">চালিয়ে যেতে Login করুন</div>
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
          <span className="text-muted-foreground">{v.visible === false ? "লুকানো" : "দেখানো"}</span>
          <Switch
            checked={v.visible !== false}
            onCheckedChange={(x) => onChange({ ...v, visible: x })}
          />
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{PLACEMENT_HELP[keyName]}</p>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={!isCustom}
            onChange={() => onChange({ ...v, source: "global" })}
          />
          মূল লোগো ব্যবহার করুন
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={isCustom}
            onChange={() => onChange({ ...v, source: "custom" })}
          />
          আলাদা লোগো দিন
        </label>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["logo", "wordmark", "both"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={(v.mode ?? "both") === m ? "default" : "outline"}
            size="sm"
            onClick={() => onChange({ ...v, mode: m })}
            className="h-7 px-2 text-[11px]"
          >
            {m === "logo" ? "শুধু আইকন" : m === "wordmark" ? "শুধু নাম" : "দুটোই"}
          </Button>
        ))}
      </div>
      {isCustom && (
        <div className="grid gap-2 border-t pt-2">
          <AssetUploader
            slot={`${keyName}Logo`}
            label="এই জায়গার আইকন লোগো"
            helperText="শুধু এই জায়গাতেই ব্যবহৃত হবে।"
            value={v.logo ?? null}
            onChange={(logo) => onChange({ ...v, logo })}
            bucketPath={`placements/${keyName}`}
            maxBytes={MAX_LOGO_BYTES}
            previewTone="square"
          />
          <AssetUploader
            slot={`${keyName}Wordmark`}
            label="এই জায়গার নাম লোগো"
            helperText="নাম বা wordmark; শুধু এই জায়গাতেই ব্যবহৃত হবে।"
            value={v.wordmark ?? null}
            onChange={(wordmark) => onChange({ ...v, wordmark })}
            bucketPath={`placements/${keyName}`}
            maxBytes={MAX_LOGO_BYTES}
            previewTone="wide"
          />
        </div>
      )}
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
        title="প্ল্যাটফর্ম ব্র্যান্ডিং"
        description="ORZEN-এর কোন লোগো কোথায় দেখাবে তা এখান থেকে সহজে নিয়ন্ত্রণ করুন। প্রকাশ না করা পর্যন্ত বর্তমান লোগো অপরিবর্তিত থাকবে।"
      />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p><strong>সহজ নিয়ম:</strong> হালকা ঘরে গাঢ় রঙের লোগো এবং Dark ঘরে সাদা/হালকা রঙের স্বচ্ছ লোগো দিন।</p>
      </div>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-1 text-sm font-semibold sm:text-base">মূল আইকন লোগো</h2>
        <p className="mb-3 text-xs text-muted-foreground">নাম ছাড়া শুধু ORZEN-এর প্রতীক বা চিহ্ন।</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LOGO_KEYS.map(([k, label, helperText, previewTone]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              helperText={helperText}
              previewTone={previewTone}
              value={assets[k] ?? null}
              onChange={(v) => setAssets((s) => ({ ...s, [k]: v }))}
              bucketPath="logos"
              maxBytes={MAX_LOGO_BYTES}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-1 text-sm font-semibold sm:text-base">নামসহ লোগো (Wordmark)</h2>
        <p className="mb-3 text-xs text-muted-foreground">ORZEN লেখা বা ব্র্যান্ডের নামসহ চওড়া লোগো।</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WORDMARK_KEYS.map(([k, label, helperText, previewTone]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              helperText={helperText}
              previewTone={previewTone}
              value={assets[k] ?? null}
              onChange={(v) => setAssets((s) => ({ ...s, [k]: v }))}
              bucketPath="wordmarks"
              maxBytes={MAX_LOGO_BYTES}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-1 text-sm font-semibold sm:text-base">আইকন ও নাম লোগো কীভাবে দেখাবে</h2>
        <p className="mb-3 text-xs text-muted-foreground">দুটো লোগো পাশাপাশি বা আলাদাভাবে দেখানোর সাধারণ নিয়ম।</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">কোন লোগো দেখাবে</Label>
            <select
              value={combo.mode ?? "both"}
              onChange={(e) => setCombo({ ...combo, mode: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="logo">শুধু আইকন লোগো</option>
              <option value="wordmark">শুধু নাম লোগো</option>
              <option value="both">আইকন + নাম লোগো</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">কীভাবে সাজাবে</Label>
            <select
              value={combo.layout ?? "left"}
              onChange={(e) => setCombo({ ...combo, layout: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="left">পাশাপাশি: আইকন বামে, নাম ডানে</option>
              <option value="top">উপর-নিচে: আইকন উপরে, নাম নিচে</option>
              <option value="centered">মাঝখানে</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">অবস্থান</Label>
            <select
              value={combo.align ?? "start"}
              onChange={(e) => setCombo({ ...combo, align: e.target.value as any })}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="start">বামে</option>
              <option value="center">মাঝে</option>
              <option value="end">ডানে</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">দুই লোগোর মাঝের দূরত্ব ({combo.gap ?? 8}px)</Label>
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
            <Label className="text-xs">আইকন লোগোর আকার ({combo.logoSize ?? 32}px)</Label>
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
            <Label className="text-xs">নাম লোগোর আকার ({combo.wordmarkSize ?? 24}px)</Label>
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
        <h2 className="mb-1 text-sm font-semibold sm:text-base">Browser ও App Icon</h2>
        <p className="mb-3 text-xs text-muted-foreground">এগুলো website-এর ভেতরের header-এ নয়; browser tab ও install করা app-এ দেখা যাবে।</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ICON_KEYS.map(([k, label, helperText]) => (
            <AssetUploader
              key={k}
              slot={k}
              label={label}
              helperText={helperText}
              previewTone="square"
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
          <h2 className="text-sm font-semibold sm:text-base">লোগো কেমন দেখাবে</h2>
        </div>
        <LivePreview b={previewBranding} />
        {(!assets.darkLogo || !assets.darkWordmark) && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Dark Mode-এর জন্য {!assets.darkLogo && !assets.darkWordmark ? "আইকন ও নাম লোগো" : !assets.darkLogo ? "আইকন লোগো" : "নাম লোগো"} দেওয়া নেই। আপাতত প্রধান লোগো দেখাবে।</span>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-3 sm:p-4">
        <h2 className="mb-1 text-sm font-semibold sm:text-base">কোথায় কোন লোগো দেখাবে</h2>
        <p className="mb-3 text-xs text-muted-foreground">প্রতিটি জায়গায় মূল লোগো রাখুন, অথবা প্রয়োজন হলে সেই জায়গার জন্য আলাদা লোগো দিন।</p>
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
          “মূল লোগো ব্যবহার করুন” রাখা জায়গায় উপরের প্রধান icon ও নাম লোগো নিজে থেকেই দেখাবে।
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
              {PLACEMENT_LABELS[k as PlacementKey] ?? k} আগের অবস্থায় নিন
            </Button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button variant="outline" onClick={doSave} disabled={saving || publishing}>
          {saving ? "সেভ হচ্ছে…" : "পরিবর্তন সেভ করুন"}
        </Button>
        <Button onClick={doPublish} disabled={saving || publishing}>
          {publishing ? "প্রকাশ হচ্ছে…" : "সব জায়গায় প্রকাশ করুন"}
        </Button>
      </div>
    </div>
  );
}
