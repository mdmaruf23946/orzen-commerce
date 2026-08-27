// Dual icon control for main categories: 1–3 preset lucide icons OR custom upload.
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { CategoryIconCluster } from "@/components/CategoryIconCluster";
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_GROUPS,
  MAX_CATEGORY_ICONS,
  parseIconNames,
  searchIconKeys,
  serializeIconNames,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIconPicker({
  storeId,
  iconName,
  imageUrl,
  onChangeIcon,
  onChangeImage,
}: {
  storeId: string;
  iconName: string | null;
  imageUrl: string | null;
  onChangeIcon: (v: string | null) => void;
  onChangeImage: (v: string | null) => void;
}) {
  const [mode, setMode] = useState<"preset" | "upload">(imageUrl && !iconName ? "upload" : "preset");
  const selected = parseIconNames(iconName);

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : selected.length >= MAX_CATEGORY_ICONS
        ? selected
        : [...selected, key];
    onChangeIcon(serializeIconNames(next));
    if (next.length) onChangeImage(null);
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "preset" ? "default" : "outline"}
          onClick={() => {
            setMode("preset");
            onChangeImage(null);
          }}
        >
          Choose preset icon
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => {
            setMode("upload");
            onChangeIcon(null);
          }}
        >
          Upload custom icon
        </Button>
      </div>

      {mode === "preset" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
              {selected.length ? (
                <CategoryIconCluster iconName={iconName} />
              ) : (
                <span className="text-[10px]">Preview</span>
              )}
            </span>
            <div className="min-w-0">
              <p>
                {selected.length
                  ? `${selected.length} of ${MAX_CATEGORY_ICONS} selected: ${selected.join(", ")}`
                  : `Pick up to ${MAX_CATEGORY_ICONS} icons below.`}
              </p>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeIcon(null)}
                  className="mt-1 inline-flex items-center rounded px-2 py-1 hover:bg-muted"
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>
          <div className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8">
            {CATEGORY_ICON_KEYS.map((key) => {
              const Icon = CATEGORY_ICONS[key];
              const idx = selected.indexOf(key);
              const active = idx >= 0;
              const full = !active && selected.length >= MAX_CATEGORY_ICONS;
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  aria-label={key}
                  aria-pressed={active}
                  disabled={full}
                  onClick={() => toggle(key)}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border transition hover:bg-muted",
                    active && "border-primary bg-primary/10",
                    full && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {active && (
                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <ImageUploader
            storeId={storeId}
            value={imageUrl}
            accept="image/*"
            onChange={(v) => {
              onChangeImage(v);
              if (v) onChangeIcon(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            SVG, PNG or WEBP. Recommended 512×512 (square).
          </p>
        </div>
      )}
    </div>
  );
}
