// Upload multiple gallery images to store-assets/{folder}/...
import { useRef, useState } from "react";
import { Plus, X, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;

export function GalleryUploader({
  storeId,
  folder,
  value,
  onChange,
  max = MAX_IMAGES,
}: {
  storeId?: string;
  folder?: string;
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const dir = folder || storeId;

  async function uploadFiles(files: FileList) {
    if (!dir) {
      toast.error("Upload folder not ready");
      return;
    }
    const remaining = max - value.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} images`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setProgress({ done: 0, total: toUpload.length });
    const uploaded: string[] = [];
    try {
      let done = 0;
      for (const raw of toUpload) {
        if (!raw.type.startsWith("image/")) {
          toast.error(`${raw.name}: not an image`);
          done++;
          setProgress({ done, total: toUpload.length });
          continue;
        }
        const file = await compressImage(raw);
        if (file.size > MAX_BYTES) {
          toast.error(`${raw.name}: too large (max 5 MB)`);
          done++;
          setProgress({ done, total: toUpload.length });
          continue;
        }
        const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const ext = rawExt.slice(0, 5) || "jpg";
        const path = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("store-assets").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (error) {
          console.error("Upload error:", error);
          toast.error(error.message || "Upload failed");
        } else {
          uploaded.push(path);
        }
        done++;
        setProgress({ done, total: toUpload.length });
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded]);
        toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...value];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((path, idx) => {
          const src = path.startsWith("http") ? path : `/api/img/${path}`;
          return (
            <div key={path + idx} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 py-0.5 text-white">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move left">
                  <ArrowLeft className="h-3 w-3 disabled:opacity-30" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === value.length - 1}
                  aria-label="Move right"
                >
                  <ArrowRight className="h-3 w-3 disabled:opacity-30" />
                </button>
              </div>
            </div>
          );
        })}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="grid h-20 w-20 place-items-center rounded-md border border-dashed bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Add image"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
        }}
      />
      <p className="text-xs text-muted-foreground">
        {progress
          ? `Uploading ${progress.done}/${progress.total}…`
          : uploading
            ? "Uploading…"
            : `Up to ${max} images, max 5 MB each.`}
      </p>
    </div>
  );
}
