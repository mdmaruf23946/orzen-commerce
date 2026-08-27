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
  folder,
  iconName,
  imageUrl,
  iconStyle = "outline",
  onChangeIcon,
  onChangeImage,
  onChangeIconStyle,
}: {
  storeId?: string;
  folder?: string;
  iconName: string | null;
  imageUrl: string | null;
  iconStyle?: "outline" | "colored";
  onChangeIcon: (v: string | null) => void;
  onChangeImage: (v: string | null) => void;
  onChangeIconStyle?: (v: "outline" | "colored") => void;
}) {
  const [mode, setMode] = useState<"preset" | "upload">(imageUrl && !iconName ? "upload" : "preset");
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const selected = parseIconNames(iconName);

  const visibleKeys = useMemo(() => {
    const base =
      CATEGORY_ICON_GROUPS.find((g) => g.key === group)?.icons ?? CATEGORY_ICON_GROUPS[0].icons;
    return searchIconKeys(base, query);
  }, [group, query]);

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
    <div className="min-w-0 space-y-2 overflow-hidden rounded-lg border p-2 sm:space-y-3 sm:p-3">
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "preset" ? "default" : "outline"}
          onClick={() => {
            setMode("preset");
            onChangeImage(null);
          }}
          className="h-8 min-w-0 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
        >
          Preset icons
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => {
            setMode("upload");
            onChangeIcon(null);
          }}
          className="h-8 min-w-0 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
        >
          Custom upload
        </Button>
      </div>

      {mode === "preset" ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Icon style</p>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {(
                [
                  { key: "outline", label: "Standard outline", hint: "Minimal monochrome lines" },
                  { key: "colored", label: "Colored illustrated", hint: "Pastel badge + multi-tone" },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onChangeIconStyle?.(o.key)}
                  aria-pressed={iconStyle === o.key}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-lg border p-1.5 text-left transition sm:gap-2 sm:p-2",
                    iconStyle === o.key ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted sm:h-10 sm:w-10 sm:rounded-lg">
                    <CategoryIconCluster
                      iconName={iconName ?? "shopping-bag"}
                      iconStyle={o.key}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-medium leading-tight sm:text-xs">{o.label}</span>
                    <span className="hidden text-[10px] text-muted-foreground sm:block">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted sm:h-14 sm:w-14 sm:rounded-xl">
              {selected.length ? (
                <CategoryIconCluster iconName={iconName} iconStyle={iconStyle} />
              ) : (
                <span className="text-[9px]">Preview</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2">
                {selected.length
                  ? `${selected.length}/${MAX_CATEGORY_ICONS}: ${selected.join(", ")}`
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

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icon by name..."
              className="h-8 pl-8 text-sm sm:h-9"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_ICON_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroup(g.key)}
                aria-pressed={group === g.key}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium transition sm:px-3 sm:text-xs",
                  group === g.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="grid max-h-28 grid-cols-6 gap-1 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-56 sm:grid-cols-8 sm:gap-2">
            {visibleKeys.length === 0 && (
              <p className="col-span-full py-4 text-center text-xs text-muted-foreground sm:py-6">
                No icons match “{query}”.
              </p>
            )}
            {visibleKeys.map((key) => {
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
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  {active && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground sm:-right-1 sm:-top-1 sm:h-4 sm:w-4 sm:text-[9px]">
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
