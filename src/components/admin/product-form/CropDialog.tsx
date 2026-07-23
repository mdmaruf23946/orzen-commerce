import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Aspect = { label: string; value: number | undefined };
const ASPECTS: Aspect[] = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
  { label: "Free", value: undefined },
];

export default function CropDialog({
  path,
  onClose,
  onSaved,
}: {
  path: string;
  onClose: () => void;
  onSaved: (newPath: string) => void;
}) {
  const src = `/api/img/${path}`;
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onComplete = useCallback((_a: Area, p: Area) => setPixels(p), []);

  async function save() {
    if (!pixels) return;
    setSaving(true);
    try {
      const img = await loadImage(src);
      const canvas = document.createElement("canvas");
      const safe = Math.max(img.width, img.height) * 2;
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const rad = (rotation * Math.PI) / 180;
      // draw rotated source into a temp, then crop
      const temp = document.createElement("canvas");
      temp.width = safe;
      temp.height = safe;
      const tctx = temp.getContext("2d")!;
      tctx.translate(safe / 2, safe / 2);
      tctx.rotate(rad);
      tctx.drawImage(img, -img.width / 2, -img.height / 2);
      const offX = (safe - img.width) / 2;
      const offY = (safe - img.height) / 2;
      ctx.drawImage(
        temp,
        pixels.x + offX,
        pixels.y + offY,
        pixels.width,
        pixels.height,
        0,
        0,
        pixels.width,
        pixels.height,
      );
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/webp", 0.9),
      );
      const dir = path.split("/").slice(0, -1).join("/") || path.split("/")[0];
      const newPath = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(newPath, blob, { contentType: "image/webp", upsert: false });
      if (error) throw new Error(error.message);
      onSaved(newPath);
      toast.success("Image cropped");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
        </DialogHeader>
        <div className="relative h-80 w-full overflow-hidden rounded-md bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onComplete}
          />
        </div>
        <div className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(a.value)}
                className={`rounded-full border px-3 py-1 text-xs ${aspect === a.value ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span>Zoom</span>
              <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            </label>
            <label className="space-y-1">
              <span>Rotate</span>
              <input type="range" min={0} max={360} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save crop"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Failed to load image"));
    img.src = src;
  });
}
