// Type-aware AI Product Builder wizard.
// Step 1 images + classification -> Step 2 type-specific essentials ->
// Step 3 describe -> generate -> hand off to the matching product form.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowLeft, ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { INCLUDED_ITEMS } from "@/lib/digital";
import { generateProductDraft, type ProductDraft } from "@/lib/ai-product-builder.functions";
import { ProductDialog } from "./ProductDialog";
import { ServiceProductDialog } from "./service/ServiceProductDialog";
import { SubscriptionProductDialog } from "./subscription/SubscriptionProductDialog";
import { StepBasics, type BuilderCategory } from "./ai-builder/StepBasics";
import { StepEssentials } from "./ai-builder/StepEssentials";
import { StepDescribe } from "./ai-builder/StepDescribe";
import {
  PLAN_KEYS,
  PLAN_LABEL,
  defaultEssentials,
  essentialsReady,
  type AiEssentials,
  type AiExtras,
  type AiProductType,
} from "./ai-builder/types";

import { useFeature } from "@/components/admin/FeatureGate";

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MIN_DIM = 200;
const MAX_DIM = 8000;

async function readDimensions(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const dim = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return dim;
  } catch {
    return null;
  }
}

const STAGES = [
  "Analyzing images…",
  "Understanding product…",
  "Generating product…",
  "Creating variants…",
  "Optimizing SEO…",
  "Finalizing product…",
  "Opening preview…",
];

type Props = {
  storeId: string;
  categories: BuilderCategory[];
  productDefaults: any;
  productType?: AiProductType;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
};

export function AIProductBuilderDialog({
  storeId,
  categories,
  productDefaults,
  productType = "physical",
  onClose,
  onSave,
}: Props) {
  const { allowed, loading: gateLoading } = useFeature("ai_product_builder");
  const gen = useServerFn(generateProductDraft);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [images, setImages] = useState<string[]>([]); // storage paths
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ name: string; reason: string }[]>([]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [ess, setEss] = useState<AiEssentials>(() => defaultEssentials());
  const [extras, setExtrasState] = useState<AiExtras>({ youtubeUrl: "", facebookUrl: "", demoVideoUrl: "" });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [draftResult, setDraftResult] = useState<{
    draft: ProductDraft;
    matchedCategoryId: string | null;
    matchedSubcategoryId: string | null;
    imagePaths: string[];
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (stageTimer.current) clearInterval(stageTimer.current); }, []);

  const set = <K extends keyof AiEssentials>(key: K, value: AiEssentials[K]) =>
    setEss((p) => ({ ...p, [key]: value }));
  const setExtras = <K extends keyof AiExtras>(key: K, value: AiExtras[K]) =>
    setExtrasState((p) => ({ ...p, [key]: value }));

  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? "",
    [categories, categoryId],
  );
  const subcategoryName = useMemo(
    () => categories.find((c) => c.id === subcategoryId)?.name ?? "",
    [categories, subcategoryId],
  );

  async function uploadFiles(files: FileList) {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images`);
      return;
    }
    const toProcess = Array.from(files);
    const overflow = toProcess.length - remaining;
    const toUpload = toProcess.slice(0, remaining);
    setUploading(true);
    const errors: { name: string; reason: string }[] = [];
    if (overflow > 0) {
      errors.push({ name: "—", reason: `${overflow} extra file(s) skipped (max ${MAX_IMAGES} images).` });
    }
    const uploaded: string[] = [];
    try {
      for (const raw of toUpload) {
        if (!ALLOWED_TYPES.includes(raw.type)) {
          errors.push({ name: raw.name, reason: `Unsupported type (${raw.type || "unknown"}). Use JPG, PNG, WebP, or GIF.` });
          continue;
        }
        if (raw.size > MAX_BYTES) {
          errors.push({ name: raw.name, reason: `Too large before compression (${(raw.size / 1024 / 1024).toFixed(1)} MB, max 5 MB).` });
          continue;
        }
        const dims = await readDimensions(raw);
        if (!dims) {
          errors.push({ name: raw.name, reason: "Could not read image — file may be corrupted." });
          continue;
        }
        if (dims.w < MIN_DIM || dims.h < MIN_DIM) {
          errors.push({ name: raw.name, reason: `Too small (${dims.w}×${dims.h}px, min ${MIN_DIM}×${MIN_DIM}px).` });
          continue;
        }
        if (dims.w > MAX_DIM || dims.h > MAX_DIM) {
          errors.push({ name: raw.name, reason: `Too large (${dims.w}×${dims.h}px, max ${MAX_DIM}×${MAX_DIM}px).` });
          continue;
        }
        const file = await compressImage(raw);
        if (file.size > MAX_BYTES) {
          errors.push({ name: raw.name, reason: `Still too large after compression (${(file.size / 1024 / 1024).toFixed(1)} MB).` });
          continue;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
        const path = `${storeId}/ai-tmp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("store-assets").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (error) errors.push({ name: raw.name, reason: error.message || "Upload failed" });
        else uploaded.push(path);
      }
      if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
      setUploadErrors(errors);
      if (errors.length && !uploaded.length) {
        toast.error("No images were added — see errors below.");
      } else if (errors.length) {
        toast.warning(`${uploaded.length} added, ${errors.length} skipped.`);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function knownFacts(): string {
    const lines: string[] = [];
    if (productType === "subscription") {
      const enabled = PLAN_KEYS.filter((k) => ess.plans[k].enabled && Number(ess.plans[k].price) > 0);
      if (enabled.length)
        lines.push(`Billing plans: ${enabled.map((k) => `${PLAN_LABEL[k]} ${ess.plans[k].price} BDT`).join(", ")}`);
      if (ess.trialEnabled) lines.push(`Free trial: ${ess.trialDays} days`);
      lines.push(`Activation: ${ess.activation}`, `Renewal: ${ess.renewal}`);
    } else if (ess.price) {
      lines.push(`Price: ${ess.price} BDT${ess.pricingMode === "starting" && productType === "service" ? " (starting from)" : ""}`);
    }
    if (productType === "physical") {
      if (ess.warranty) lines.push(`Warranty: ${ess.warranty}`);
      if (ess.manufacturer) lines.push(`Manufacturer: ${ess.manufacturer}`);
      if (ess.origin) lines.push(`Country of origin: ${ess.origin}`);
      if (ess.weight) lines.push(`Weight: ${ess.weight} g`);
    }
    if (productType === "digital") {
      lines.push(`Delivery: ${ess.deliveryType}`, `License: ${ess.licenseType}`);
      if (ess.fileVersion) lines.push(`Version: ${ess.fileVersion}`);
      if (ess.files.length) lines.push(`Files: ${ess.files.map((f) => f.name).join(", ")}`);
    }
    if (productType === "service") {
      lines.push(`Booking required: ${ess.bookingRequired ? "yes" : "no"}`, `Mode: ${ess.serviceMode}`);
      if (ess.serviceArea) lines.push(`Service area: ${ess.serviceArea}`);
      if (ess.deliveryTime) lines.push(`Delivery time: ${ess.deliveryTime}`);
      if (ess.responseTime) lines.push(`Response time: ${ess.responseTime}`);
    }
    return lines.join("\n");
  }

  async function generate() {
    if (images.length === 0 && !description.trim()) {
      toast.error("Add at least one image or a description");
      return;
    }
    setGenerationError(null);
    setBusy(true);
    setStage(0);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < STAGES.length - 2 ? s + 1 : s));
    }, 2200);
    try {
      const res = await gen({
        data: {
          imagePaths: images,
          description,
          productType,
          categoryName,
          subcategoryName,
          brand,
          knownFacts: knownFacts(),
        },
      });
      setStage(STAGES.length - 1);
      setDraftResult(res as any);
    } catch (e) {
      const message = (e as Error).message || "Generation failed. Please try again.";
      setGenerationError(message);
      toast.error(message);
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      stageTimer.current = null;
      setBusy(false);
    }
  }

  // Once we have a draft, hand off to the matching product form prefilled.
  if (draftResult) {
    const editingLike = buildEditingLike(
      { ...draftResult, matchedCategoryId: categoryId || draftResult.matchedCategoryId, matchedSubcategoryId: subcategoryId || draftResult.matchedSubcategoryId },
      extras,
      ess,
      brand,
      productType,
    );
    if (productType === "subscription") {
      return (
        <SubscriptionProductDialog
          storeId={storeId}
          editing={editingLike}
          categories={categories as any}
          productDefaults={productDefaults}
          onClose={onClose}
          onSave={onSave}
        />
      );
    }
    if (productType === "service") {
      return (
        <ServiceProductDialog
          storeId={storeId}
          editing={editingLike}
          categories={categories as any}
          productDefaults={productDefaults}
          onClose={onClose}
          onSave={onSave}
        />
      );
    }
    return (
      <ProductDialog
        storeId={storeId}
        editing={editingLike}
        categories={categories as any}
        productDefaults={productDefaults}
        initialType={productType}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  const canContinueStep1 = !!categoryId && (productType === "service" || productType === "subscription" || images.length > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Product Builder
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Premium
            </span>
          </DialogTitle>
        </DialogHeader>

        {gateLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
        ) : !allowed ? (
          <UpgradeCTA />
        ) : busy ? (
          <ProgressPanel stage={stage} />
        ) : (
          <>
            {generationError && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {generationError}
              </div>
            )}
            <StepIndicator step={step} />
            {step === 1 ? (
              <StepBasics
                productType={productType}
                maxImages={MAX_IMAGES}
                minDim={MIN_DIM}
                images={images}
                uploading={uploading}
                errors={uploadErrors}
                onDismissErrors={() => setUploadErrors([])}
                onPick={() => fileRef.current?.click()}
                onCamera={() => cameraRef.current?.click()}
                onRemove={removeImage}
                categories={categories}
                categoryId={categoryId}
                setCategoryId={setCategoryId}
                subcategoryId={subcategoryId}
                setSubcategoryId={setSubcategoryId}
                brand={brand}
                setBrand={setBrand}
              />
            ) : step === 2 ? (
              <StepEssentials storeId={storeId} productType={productType} ess={ess} set={set} />
            ) : (
              <StepDescribe
                productType={productType}
                description={description}
                setDescription={setDescription}
                extras={extras}
                setExtras={setExtras}
              />
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />

            <div className="mt-4 flex items-center justify-between gap-2">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step === 1 ? (
                <Button onClick={() => setStep(2)} disabled={!canContinueStep1}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : step === 2 ? (
                <Button onClick={() => setStep(3)} disabled={!essentialsReady(productType, ess)}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={generate} disabled={uploading}>
                  <Sparkles className="mr-1 h-4 w-4" /> Generate Product
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs">
      <StepPill n={1} active={step === 1} done={step > 1} label="Images" />
      <div className="h-px flex-1 bg-border" />
      <StepPill n={2} active={step === 2} done={step > 2} label="Essentials" />
      <div className="h-px flex-1 bg-border" />
      <StepPill n={3} active={step === 3} done={false} label="Describe" />
    </div>
  );
}
function StepPill({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? "text-foreground" : "text-muted-foreground"}`}>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ProgressPanel({ stage }: { stage: number }) {
  return (
    <div className="space-y-3 py-6">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="font-medium">{STAGES[stage] ?? STAGES[STAGES.length - 1]}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        AI generation can take 30–60 seconds with product photos. Keep this window open while the preview is prepared.
      </p>
      <ol className="space-y-1.5 text-xs">
        {STAGES.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i < stage ? "text-emerald-600 dark:text-emerald-400" : i === stage ? "text-foreground" : "text-muted-foreground"}`}>
            {i < stage ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />}
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function UpgradeCTA() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <Lock className="h-6 w-6" />
      </div>
      <div className="text-lg font-semibold">Upgrade to Premium to use AI Product Builder</div>
      <p className="text-sm text-muted-foreground">
        Generate complete, editable products from photos and a short description in seconds.
      </p>
      <Link to="/admin/billing" search={{} as never} className="w-full">
        <Button className="w-full gap-1.5">
          <Sparkles className="h-4 w-4" /> Upgrade
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- mapping

const num = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Turn an AI draft + the wizard's essentials into `editing`-shaped data. */
function buildEditingLike(
  res: {
    draft: ProductDraft;
    matchedCategoryId: string | null;
    matchedSubcategoryId: string | null;
    imagePaths: string[];
  },
  extras: AiExtras,
  ess: AiEssentials,
  brand: string,
  productType: AiProductType,
) {
  const { draft, matchedCategoryId, matchedSubcategoryId, imagePaths } = res;
  const primaryIdx = Math.min(Math.max(draft.primary_image_index ?? 0, 0), Math.max(0, imagePaths.length - 1));
  const primary = imagePaths[primaryIdx] ?? imagePaths[0] ?? null;
  const gallery = imagePaths.filter((p) => p !== primary);

  const videos: { url: string; provider: "youtube" | "facebook"; primary?: boolean }[] = [];
  const yt = extras.youtubeUrl?.trim();
  const fb = extras.facebookUrl?.trim();
  if (yt) videos.push({ url: yt, provider: "youtube" });
  if (fb) videos.push({ url: fb, provider: "facebook" });
  if (videos.length > 0) videos[0].primary = true;
  const demo = extras.demoVideoUrl?.trim() || null;
  const primaryVideoUrl = videos[0]?.url ?? demo;

  // Extra facts the seller typed become specifications so nothing is lost.
  const specifications = [...(draft.specifications ?? [])];
  const addSpec = (key: string, value?: string | null) => {
    if (!value) return;
    if (specifications.some((s) => s.key?.toLowerCase() === key.toLowerCase())) return;
    specifications.push({ key, value });
  };
  if (productType === "physical") {
    addSpec("Warranty", ess.warranty);
    addSpec("Manufacturer", ess.manufacturer);
    addSpec("Country of origin", ess.origin);
  }
  if (productType === "service") {
    addSpec("Service area", ess.serviceArea);
    addSpec("Delivery time", ess.deliveryTime);
    addSpec("Response time", ess.responseTime);
    addSpec("Mode", ess.serviceMode === "both" ? "Online & offline" : ess.serviceMode === "online" ? "Online" : "Offline");
  }

  const meta: Record<string, any> = {
    product_type: productType,
    subcategory_id: matchedSubcategoryId ?? null,
    videos,
    labels: draft.labels ?? [],
    seo: {
      title: draft.seo_title,
      description: draft.seo_description,
      slug: draft.slug_suggestion,
      keywords: (draft.keywords ?? []).join(", "),
    },
    shipping:
      productType === "physical"
        ? {
            type: "free",
            weight: num(ess.weight) ?? draft.suggested_weight_g ?? undefined,
            l: num(ess.dimL) ?? draft.dimensions_cm?.l ?? undefined,
            w: num(ess.dimW) ?? draft.dimensions_cm?.w ?? undefined,
            h: num(ess.dimH) ?? draft.dimensions_cm?.h ?? undefined,
          }
        : { type: "free" },
    purchase: { cod: true, online: true, min_qty: 1 },
    faq: (draft.faq ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    ai_suggestions: {
      confidence: draft.confidence,
      category_confidence: draft.category_confidence,
      completeness_score: draft.completeness_score,
      seo_score: draft.seo_score,
      missing_fields: draft.missing_fields,
      suggested_improvements: draft.suggested_improvements,
      category_guess: draft.category_guess,
      subcategory_guess: draft.subcategory_guess,
      tags: draft.tags,
      alt_texts: draft.alt_texts,
      includes: draft.includes,
      box_contents: draft.box_contents,
    },
  };

  if (productType === "physical" && (draft.box_contents ?? []).length > 0) {
    meta.box_contents = draft.box_contents;
  }

  // ---------------------------------------------------------- digital
  if (productType === "digital") {
    const includedIds = INCLUDED_ITEMS.filter((item) =>
      (draft.includes ?? []).some(
        (inc) => inc.toLowerCase().includes(item.label.toLowerCase()) || inc.toLowerCase().includes(item.id),
      ),
    ).map((item) => item.id as string);
    const reqs = draft.system_requirements ?? [];
    const reqVal = (needle: string) =>
      reqs.find((r) => r.key?.toLowerCase().includes(needle))?.value ?? undefined;
    meta.digital = {
      files: ess.files.map((f) => ({ path: f.path, name: f.name, size: f.size, type: f.type })),
      external_url: ess.deliveryType === "external" ? ess.externalUrl.trim() || null : null,
      version: ess.fileVersion.trim() || null,
      changelog: draft.changelog || null,
      platforms: [],
      tags: draft.tags ?? [],
      preview: { images: [], video_url: demo, demo_url: null },
      download: {
        mode: ess.deliveryType === "manual" ? "manual" : "instant",
        max_downloads: num(ess.downloadLimit),
        expiry_days: num(ess.expiryDays),
        allow_redownload: true,
      },
      free: false,
      license_type: ess.licenseType,
      license_note: null,
      included: includedIds,
      requirements: {
        os: reqVal("os") ?? reqVal("operating"),
        software: reqVal("software"),
        browser: reqVal("browser"),
        ram: reqVal("ram"),
        storage: reqVal("storage"),
        dependencies: reqVal("depend"),
      },
      installation: draft.installation_html || null,
      faq: (draft.faq ?? []).map((f) => ({ q: f.question, a: f.answer })),
    };
  }

  // ---------------------------------------------------------- service
  if (productType === "service") {
    const delNum = Number((ess.deliveryTime.match(/\d+/) ?? [])[0]);
    const delUnit = /hour/i.test(ess.deliveryTime) ? "hours" : /week/i.test(ess.deliveryTime) ? "weeks" : "days";
    meta.service = {
      pricing_type: ess.pricingMode === "starting" ? "starting" : "fixed",
      tax_included: false,
      delivery: {
        time: Number.isFinite(delNum) && delNum > 0 ? delNum : null,
        unit: delUnit,
        express: false,
        express_fee: null,
        express_time: null,
      },
      availability: "available",
      max_orders: null,
      max_orders_period: "day",
      included: (draft.includes ?? []).length ? draft.includes : draft.included_services ?? [],
      requirements: draft.customer_requirements ?? [],
      deliverables: draft.features ?? [],
      workflow: draft.workflow_steps ?? [],
      service_area: ess.serviceArea.trim() || null,
      response_time: ess.responseTime.trim() || null,
      mode: ess.serviceMode,
      booking: {
        type: ess.bookingRequired ? "appointment" : "instant",
        working_days: [],
        working_hours: { start: "09:00", end: "18:00" },
        slot_minutes: num(ess.appointmentMinutes) ?? 60,
        buffer_minutes: 0,
      },
      media: { portfolio: [], before_after: [], demo_video: demo },
      addons: [],
      faq: (draft.faq ?? []).map((f) => ({ question: f.question, answer: f.answer })),
      policies: {},
      flags: {},
    };
  }

  // ----------------------------------------------------- subscription
  const enabledPlans = PLAN_KEYS.filter((k) => ess.plans[k].enabled && Number(ess.plans[k].price) > 0);
  if (productType === "subscription") {
    const plans = enabledPlans.map((k, i) => ({
      id: k,
      label: PLAN_LABEL[k],
      cycle: k === "quarterly" ? "quarterly" : k,
      price: Number(ess.plans[k].price),
      compare_at: num(ess.plans[k].compare),
      badge: null,
      is_default: i === 0,
    }));
    meta.subscription = {
      billing_cycle: plans[0]?.cycle ?? "monthly",
      plans,
      custom_cycle: { number: null, unit: "months" },
      plan_type: "individual",
      badge: null,
      setup_fee: null,
      tax_included: false,
      renewal_price_mode: "same",
      renewal_price: null,
      trial: { enabled: ess.trialEnabled, duration: num(ess.trialDays) ?? 7, unit: "days" },
      activation: { type: ess.activation, delay_hours: null },
      access_items: (draft.included_services ?? draft.includes ?? []).map((label) => ({ label })),
      usage_limits: [],
      benefits: ((draft.benefits ?? []).length ? draft.benefits : draft.features ?? []).map((title) => ({ title })),
      renewal: {
        mode: ess.renewal,
        allow_upgrade: true,
        allow_downgrade: false,
        upgrade_rules: "",
        grace_period_days: 3,
        renewal_reminder_days: 7,
        expiry_reminder_days: 3,
        renewal_discount: null,
        upgrade_discount: null,
      },
      customer_fields: [],
      media: { preview_images: [], promo_video: demo, documents: [] },
      flags: {},
      publish_at: null,
      policies: {},
    };
  }

  // Variants only make sense for physical products.
  const options =
    productType === "physical"
      ? (draft.variant_options ?? []).filter((v) => v.name && v.values.length > 0)
      : [];
  const variants =
    options.length > 0
      ? {
          options,
          items: cartesian(options).map((combo, i) => ({
            id: String(i),
            options: combo,
            sku: null,
            price: null,
            discount: null,
            stock: null,
            barcode: null,
            image: null,
          })),
        }
      : [];

  const basePrice =
    productType === "subscription"
      ? Number(ess.plans[enabledPlans[0] ?? "monthly"]?.price ?? 0)
      : num(ess.price) ?? draft.suggested_price ?? 0;
  const compareAt =
    productType === "subscription"
      ? num(ess.plans[enabledPlans[0] ?? "monthly"]?.compare ?? "")
      : num(ess.oldPrice) ?? draft.suggested_old_price ?? null;

  return {
    id: undefined,
    name: draft.name,
    short_description: draft.short_description,
    description: draft.long_description_html,
    brand: brand.trim() || draft.brand || "",
    product_code: ess.sku.trim() || null,
    price: basePrice,
    old_price: compareAt,
    cost_price: num(ess.costPrice) ?? 0,
    sku: ess.sku.trim() || null,
    low_stock_threshold: num(ess.lowStock) ?? 5,
    stock: productType === "physical" ? num(ess.stock) ?? 0 : 0,
    status: "draft",
    primary_image_url: primary,
    gallery,
    video_url: primaryVideoUrl,
    category_id: matchedCategoryId,
    warranty: productType === "physical" ? ess.warranty.trim() || null : null,
    return_policy: null,
    shipping_info: null,
    is_featured: (draft.labels ?? []).includes("Featured"),
    features: draft.features ?? [],
    specifications,
    variants,
    related_product_ids: [],
    product_type: productType,
    meta,
  } as any;
}

function cartesian(options: { name: string; values: string[] }[]): Record<string, string>[] {
  if (options.length === 0) return [];
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => {
      const next: Record<string, string>[] = [];
      for (const row of acc) {
        for (const v of opt.values) next.push({ ...row, [opt.name]: v });
      }
      return next.slice(0, 200);
    },
    [{}],
  );
}
