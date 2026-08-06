// Step 1 — images + category / subcategory / brand (common to all types).
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Field, Grid, Section } from "./ui";
import type { AiProductType } from "./types";

const TYPE_LABEL: Record<AiProductType, string> = {
  physical: "Physical product",
  digital: "Digital product",
  service: "Service",
  subscription: "Subscription plan",
};

export type BuilderCategory = { id: string; name: string; parent_id?: string | null };

export function StepBasics({
  productType,
  maxImages,
  minDim,
  images,
  uploading,
  errors,
  onDismissErrors,
  onPick,
  onCamera,
  onRemove,
  categories,
  categoryId,
  setCategoryId,
  subcategoryId,
  setSubcategoryId,
  brand,
  setBrand,
}: {
  productType: AiProductType;
  maxImages: number;
  minDim: number;
  images: string[];
  uploading: boolean;
  errors: { name: string; reason: string }[];
  onDismissErrors: () => void;
  onPick: () => void;
  onCamera: () => void;
  onRemove: (i: number) => void;
  categories: BuilderCategory[];
  categoryId: string;
  setCategoryId: (v: string) => void;
  subcategoryId: string;
  setSubcategoryId: (v: string) => void;
  brand: string;
  setBrand: (v: string) => void;
}) {
  const mains = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subs = useMemo(
    () => categories.filter((c) => c.parent_id && c.parent_id === categoryId),
    [categories, categoryId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Product type</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {TYPE_LABEL[productType]}
        </span>
      </div>

      <Section title="Images">
        <p className="mb-2 text-xs text-muted-foreground">
          Add up to {maxImages} photos. JPG, PNG, WebP or GIF · min {minDim}×{minDim}px · max 5 MB each.
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
          {images.length < maxImages && (
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
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating and uploading…
          </p>
        )}
        {errors.length > 0 && (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-destructive">
                {errors.length} image{errors.length === 1 ? "" : "s"} skipped
              </span>
              <button type="button" onClick={onDismissErrors} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
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
      </Section>

      <Section title="Classification" hint="The AI writes better copy, SEO and tags when it knows the category.">
        <Grid cols={3}>
          <Field label="Category" required>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">— Select category —</option>
              {mains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subcategory">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              value={subcategoryId}
              disabled={subs.length === 0}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              <option value="">{subs.length ? "— None —" : "No subcategories"}</option>
              {subs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand" hint="optional">
            <Input placeholder="e.g. Orzen" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
        </Grid>
      </Section>
    </div>
  );
}
