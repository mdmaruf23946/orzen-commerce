// Fixed-frame cropper: the merchant drags/zooms the photo inside a frame that
// exactly matches how the website shows it. Only the framed area is saved, at an
// exact output size, so the storefront never stretches, shifts or cuts text.
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function BannerCropDialog({
  file,
  output,
  onCancel,
  onDone,
}: {
  file: File;
  output: { w: number; h: number };
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onComplete = useCallback((_a: Area, p: Area) => setPixels(p), []);
  const aspect = output.w / output.h;
  const small = natural && (natural.w < output.w * 0.6 || natural.h < output.h * 0.6);

  async function save() {
    if (!pixels || !src) return;
    setBusy(true);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = output.w;
      canvas.height = output.h;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, output.w, output.h);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("Crop failed");
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>ওয়েবসাইটে কোন অংশ দেখাবে ঠিক করুন</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          ফ্রেমের ভিতরের অংশটুকুই ওয়েবসাইটে দেখাবে; বাইরের অংশ বাদ যাবে। ছবি টেনে সরান, জুম করে ঠিক করুন।
          ({output.w}×{output.h}px)
        </p>
        <div className="relative h-[360px] w-full overflow-hidden rounded-md bg-muted">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={5}
              restrictPosition
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              onMediaLoaded={(m) => setNatural({ w: m.naturalWidth, h: m.naturalHeight })}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">জুম</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="Zoom"
          />
        </div>
        {small && (
          <p className="text-xs text-destructive">
            ছবিটি ছোট ({natural!.w}×{natural!.h}px) — ওয়েবসাইটে ঝাপসা দেখাতে পারে। বড় ছবি দিলে ভালো হয়।
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>বাতিল</Button>
          <Button type="button" onClick={save} disabled={!pixels || busy}>
            {busy ? "সেভ হচ্ছে…" : "এই অংশ রাখুন"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
