import { useCallback, useRef, useState, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, ImagePlus, LayoutGrid, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COVER_CATEGORIES, type MediaTemplate } from "@/lib/profile-media-templates";

/** Upload → crop → apply, or choose template → apply. Calls onApply(value) to auto-save. */
export function MediaMenu({
  kind, folder, templates, hasValue, onApply, children, triggerClassName,
}: {
  kind: "avatar" | "cover";
  folder?: string;
  templates: MediaTemplate[];
  hasValue: boolean;
  onApply: (value: string | null) => Promise<void>;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAvatar = kind === "avatar";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function uploadBlob(blob: Blob) {
    if (!folder) throw new Error("Upload folder not ready");
    const path = `${folder}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { error } = await supabase.storage.from("store-assets").upload(path, blob, { contentType: "image/webp", upsert: false });
    if (error) throw new Error(error.message || "Upload failed");
    await onApply(path);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={busy}>
          <button type="button" className={cn("group relative", triggerClassName)} aria-label={isAvatar ? "Change profile photo" : "Change cover photo"}>
            {children}
            {busy && <span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-background/60"><Loader2 className="h-5 w-5 animate-spin" /></span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isAvatar ? "start" : "end"}>
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />{isAvatar ? "Upload photo" : "Upload cover"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <LayoutGrid className="h-4 w-4" />{isAvatar ? "Choose avatar" : "Choose cover template"}
          </DropdownMenuItem>
          {hasValue && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={() => run(() => onApply(null))}>
                <Trash2 className="h-4 w-4" />Remove
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!f.type.startsWith("image/")) return toast.error("Please choose an image file");
          if (f.size > 15 * 1024 * 1024) return toast.error("Image is too large (max 15 MB)");
          setFileUrl(URL.createObjectURL(f));
        }}
      />

      {fileUrl && (
        <CropDialog
          src={fileUrl}
          aspect={isAvatar ? 1 : 3}
          round={isAvatar}
          outputWidth={isAvatar ? 512 : 1500}
          onClose={() => { URL.revokeObjectURL(fileUrl); setFileUrl(null); }}
          onApply={async (blob) => {
            await uploadBlob(blob);
            URL.revokeObjectURL(fileUrl);
            setFileUrl(null);
          }}
        />
      )}

      <TemplatePicker
        open={pickerOpen}
        kind={kind}
        templates={templates}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => { setPickerOpen(false); run(() => onApply(`tpl:${t.id}`)); }}
      />
    </>
  );
}

export function EditBadge({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-full border bg-background/90 text-foreground shadow-sm backdrop-blur", className)}>
      <Camera className="h-4 w-4" />
    </span>
  );
}

function CropDialog({ src, aspect, round, outputWidth, onClose, onApply }: {
  src: string; aspect: number; round: boolean; outputWidth: number;
  onClose: () => void; onApply: (blob: Blob) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const onComplete = useCallback((_a: Area, p: Area) => setPixels(p), []);

  async function apply() {
    if (!pixels) return;
    setSaving(true);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Failed to load image")); i.src = src;
      });
      const w = Math.min(outputWidth, Math.round(pixels.width));
      const h = Math.round(w / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, w, h);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image"))), "image/webp", 0.88));
      await onApply(blob);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{round ? "Crop profile photo" : "Crop cover photo"}</DialogTitle></DialogHeader>
        <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted sm:h-96">
          <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} cropShape={round ? "round" : "rect"}
            showGrid={!round} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
        </div>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Zoom</span>
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-primary" />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={apply} disabled={saving || !pixels}>{saving ? "Saving…" : "Apply"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePicker({ open, kind, templates, onClose, onPick }: {
  open: boolean; kind: "avatar" | "cover"; templates: MediaTemplate[];
  onClose: () => void; onPick: (t: MediaTemplate) => void;
}) {
  const [cat, setCat] = useState<string>("All");
  const isAvatar = kind === "avatar";
  const list = isAvatar || cat === "All" ? templates : templates.filter((t) => t.category === cat);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{isAvatar ? "Choose an avatar" : "Choose a cover template"}</DialogTitle></DialogHeader>
        {!isAvatar && (
          <div className="flex flex-wrap gap-2">
            {["All", ...COVER_CATEGORIES].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div className={cn("grid gap-3", isAvatar ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-1 sm:grid-cols-2")}>
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => onPick(t)} title={t.label}
              className={cn("overflow-hidden border transition hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                isAvatar ? "aspect-square rounded-full" : "rounded-lg")}>
              <img src={t.src} alt={t.label} className={cn("w-full object-cover", isAvatar ? "h-full" : "aspect-[3/1]")} loading="lazy" />
              {!isAvatar && <div className="px-3 py-2 text-left text-xs"><span className="font-medium">{t.label}</span> <span className="text-muted-foreground">· {t.category}</span></div>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
