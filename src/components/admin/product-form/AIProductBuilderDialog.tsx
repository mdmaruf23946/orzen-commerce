// Two-step AI Product Builder wizard.
// Step 1: images -> Step 2: description -> generate -> hand off to
// the existing ProductDialog prefilled with the AI draft.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  Camera,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle2,
  Lock,
  Youtube,
  Facebook,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { generateProductDraft, type ProductDraft } from "@/lib/ai-product-builder.functions";
import { ProductDialog } from "./ProductDialog";
import { useFeature } from "@/components/admin/FeatureGate";

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESC = 4000;
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
  categories: any[];
  productDefaults: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
};

export function AIProductBuilderDialog({ storeId, categories, productDefaults, onClose, onSave }: Props) {
  const { allowed, loading: gateLoading } = useFeature("ai_product_builder");
  const gen = useServerFn(generateProductDraft);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [images, setImages] = useState<string[]>([]); // storage paths
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ name: string; reason: string }[]>([]);
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  // Essentials (user-provided, overrides AI guesses when set)
  const [essPrice, setEssPrice] = useState<string>("");
  const [essOldPrice, setEssOldPrice] = useState<string>("");
  const [essCostPrice, setEssCostPrice] = useState<string>("");
  const [essStock, setEssStock] = useState<string>("");
  const [essLowStock, setEssLowStock] = useState<string>("5");
  const [essSku, setEssSku] = useState<string>("");
  const [essBrand, setEssBrand] = useState<string>("");
  const [essWeight, setEssWeight] = useState<string>("");
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

  async function generate() {
    if (images.length === 0 && !description.trim()) {
      toast.error("Add at least one image or a description");
      return;
    }
    setGenerationError(null);
    setBusy(true);
    setStage(0);
    // Simulated staged progress while awaiting the model.
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < STAGES.length - 2 ? s + 1 : s));
    }, 2200);
    try {
      const res = await gen({ data: { imagePaths: images, description } });
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

  // Once we have a draft, hand off to the existing ProductDialog prefilled.
  if (draftResult) {
    const essentials = {
      price: essPrice ? Number(essPrice) : undefined,
      old_price: essOldPrice ? Number(essOldPrice) : undefined,
      cost_price: essCostPrice ? Number(essCostPrice) : undefined,
      stock: essStock ? Number(essStock) : undefined,
      low_stock_threshold: essLowStock ? Number(essLowStock) : undefined,
      sku: essSku.trim() || undefined,
      brand: essBrand.trim() || undefined,
      weight_g: essWeight ? Number(essWeight) : undefined,
    };
    const editingLike = buildEditingLike(draftResult, { youtubeUrl, facebookUrl }, essentials);
    return (
      <ProductDialog
        storeId={storeId}
        editing={editingLike}
        categories={categories}
        productDefaults={productDefaults}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Product Builder
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
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
              <StepImages
                images={images}
                uploading={uploading}
                errors={uploadErrors}
                onDismissErrors={() => setUploadErrors([])}
                onPick={() => fileRef.current?.click()}
                onCamera={() => cameraRef.current?.click()}
                onRemove={removeImage}
              />
            ) : step === 2 ? (
              <StepEssentials
                price={essPrice} setPrice={setEssPrice}
                oldPrice={essOldPrice} setOldPrice={setEssOldPrice}
                costPrice={essCostPrice} setCostPrice={setEssCostPrice}
                stock={essStock} setStock={setEssStock}
                lowStock={essLowStock} setLowStock={setEssLowStock}
                sku={essSku} setSku={setEssSku}
                brand={essBrand} setBrand={setEssBrand}
                weight={essWeight} setWeight={setEssWeight}
              />
            ) : (
              <StepDescription
                description={description}
                setDescription={setDescription}
                youtubeUrl={youtubeUrl}
                setYoutubeUrl={setYoutubeUrl}
                facebookUrl={facebookUrl}
                setFacebookUrl={setFacebookUrl}
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
                <Button onClick={() => setStep(2)} disabled={images.length === 0}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : step === 2 ? (
                <Button onClick={() => setStep(3)} disabled={!essPrice || Number(essPrice) <= 0}>
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

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-4 flex items-center gap-3 text-xs">
      <StepPill n={1} active={step === 1} done={step > 1} label="Upload images" />
      <div className="h-px flex-1 bg-border" />
      <StepPill n={2} active={step === 2} done={false} label="Describe product" />
    </div>
  );
}
function StepPill({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "text-foreground" : "text-muted-foreground"}`}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
          done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function StepImages({
  images,
  uploading,
  errors,
  onDismissErrors,
  onPick,
  onCamera,
  onRemove,
}: {
  images: string[];
  uploading: boolean;
  errors: { name: string; reason: string }[];
  onDismissErrors: () => void;
  onPick: () => void;
  onCamera: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add up to {MAX_IMAGES} product photos. JPG, PNG, WebP, or GIF · min {MIN_DIM}×{MIN_DIM}px · max 5 MB each.
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((path, idx) => (
          <div key={path + idx} className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
            <img src={`/api/img/${path}`} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <>
            <button
              type="button"
              onClick={onPick}
              disabled={uploading}
              className="grid h-24 w-24 place-items-center gap-1 rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ImageIcon className="h-5 w-5" />
              Gallery
            </button>
            <button
              type="button"
              onClick={onCamera}
              disabled={uploading}
              className="grid h-24 w-24 place-items-center gap-1 rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              Camera
            </button>
          </>
        )}
      </div>
      {uploading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating and uploading…
        </p>
      )}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-destructive">
              {errors.length} image{errors.length === 1 ? "" : "s"} skipped
            </span>
            <button
              type="button"
              onClick={onDismissErrors}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-muted-foreground">
                <span className="font-medium text-foreground">{e.name}:</span> {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepDescription({
  description,
  setDescription,
  youtubeUrl,
  setYoutubeUrl,
  facebookUrl,
  setFacebookUrl,
}: {
  description: string;
  setDescription: (v: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  facebookUrl: string;
  setFacebookUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Tell the AI everything you know. The more detail you give, the better the result.
        </p>
        <Textarea
          rows={10}
          maxLength={MAX_DESC}
          placeholder={`Describe your product in as much detail as possible.

Example:
Product name
Brand
Color / Material / Size / Weight
Specifications
Key features
What's in the package
Warranty
Target customer
Selling price
Anything else`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="text-right text-xs text-muted-foreground">
          {description.length} / {MAX_DESC}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Youtube className="h-3.5 w-3.5 text-red-500" />
            YouTube URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            type="url"
            placeholder="https://youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Facebook className="h-3.5 w-3.5 text-blue-600" />
            Facebook Video URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            type="url"
            placeholder="https://facebook.com/…"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
          />
        </div>
      </div>
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
          <li key={s} className={`flex items-center gap-2 ${i < stage ? "text-emerald-600" : i === stage ? "text-foreground" : "text-muted-foreground"}`}>
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
      <Link to="/admin/billing" className="w-full">
        <Button className="w-full gap-1.5">
          <Sparkles className="h-4 w-4" /> Upgrade
        </Button>
      </Link>
    </div>
  );
}

// Turn an AI draft into the same shape ProductDialog expects for `editing`.
function buildEditingLike(
  res: {
    draft: ProductDraft;
    matchedCategoryId: string | null;
    matchedSubcategoryId: string | null;
    imagePaths: string[];
  },
  extras: { youtubeUrl?: string; facebookUrl?: string } = {},
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
  const primaryVideoUrl = videos[0]?.url ?? null;

  const meta: Record<string, any> = {
    product_type: "physical",
    subcategory_id: matchedSubcategoryId ?? null,
    videos,
    labels: draft.labels ?? [],
    seo: {
      title: draft.seo_title,
      description: draft.seo_description,
      slug: draft.slug_suggestion,
      keywords: (draft.keywords ?? []).join(", "),
    },
    shipping: {
      type: "free",
      weight: draft.suggested_weight_g ?? undefined,
      l: draft.dimensions_cm?.l ?? undefined,
      w: draft.dimensions_cm?.w ?? undefined,
      h: draft.dimensions_cm?.h ?? undefined,
    },
    purchase: { cod: true, online: true, min_qty: 1 },
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
    },
  };

  // Build the variants object if the AI proposed options.
  const options = (draft.variant_options ?? []).filter((v) => v.name && v.values.length > 0);
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

  return {
    id: undefined,
    name: draft.name,
    short_description: draft.short_description,
    description: draft.long_description_html,
    brand: draft.brand ?? "",
    product_code: null,
    price: draft.suggested_price ?? 0,
    old_price: draft.suggested_old_price ?? null,
    cost_price: 0,
    sku: null,
    low_stock_threshold: 5,
    stock: 0,
    status: "draft",
    primary_image_url: primary,
    gallery,
    video_url: primaryVideoUrl,
    category_id: matchedCategoryId,
    warranty: null,
    return_policy: null,
    shipping_info: null,
    is_featured: (draft.labels ?? []).includes("Featured"),
    features: draft.features ?? [],
    specifications: draft.specifications ?? [],
    variants,
    related_product_ids: [],
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
