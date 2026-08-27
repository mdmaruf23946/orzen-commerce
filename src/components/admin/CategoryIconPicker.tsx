// Dual icon control for main categories: preset lucide icon OR custom upload.
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { CATEGORY_ICONS, CATEGORY_ICON_KEYS, getCategoryIcon } from "@/lib/category-icons";
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
  const Active = getCategoryIcon(iconName);

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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {Active ? (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-md border bg-muted">
                  <Active className="h-5 w-5" />
                </span>
                <span>Selected: {iconName}</span>
                <button
                  type="button"
                  onClick={() => onChangeIcon(null)}
                  className="ml-auto inline-flex items-center rounded px-2 py-1 hover:bg-muted"
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </button>
              </>
            ) : (
              <span>Pick an icon below.</span>
            )}
          </div>
          <div className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8">
            {CATEGORY_ICON_KEYS.map((key) => {
              const Icon = CATEGORY_ICONS[key];
              const active = iconName === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  aria-label={key}
                  onClick={() => {
                    onChangeIcon(key);
                    onChangeImage(null);
                  }}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border transition hover:bg-muted",
                    active && "border-primary bg-primary/10",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {active && (
                    <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-primary" />
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
