// Upload a file (image by default) to private bucket store-assets/{folder}/...
// Stores the storage path and renders via /api/img/{path}.
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/compress-image";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function ImageUploader({
  storeId,
  folder,
  value,
  onChange,
  accept = "image/*",
  maxBytes = DEFAULT_MAX_BYTES,
  label,
  wide = false,
}: {
  storeId?: string;
  folder?: string;
  value: string | null;
  onChange: (path: string | null) => void;
  accept?: string;
  maxBytes?: number;
  label?: string;
  /** Wide, non-cropping preview for wordmark/name logos. */
  wide?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isImage = accept.startsWith("image");
  const dir = folder || storeId;

  async function handle(file: File) {
    if (!dir) {
      toast.error("Upload folder not ready");
      return;
    }
    if (isImage && !file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    let toUpload = file;
    if (isImage) {
      toUpload = await compressImage(file);
    }
    if (toUpload.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      toast.error(`File is too large (max ${mb} MB)`);
      return;
    }
    setUploading(true);
    try {
      const rawExt = (toUpload.name.split(".").pop() || (isImage ? "jpg" : "bin"))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const ext = rawExt.slice(0, 5) || (isImage ? "jpg" : "bin");
      const path = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, toUpload, {
        upsert: false,
        contentType: toUpload.type,
      });
      if (error) {
        console.error("Upload error:", error);
        throw new Error(error.message || "Upload failed. Check your permissions or try again.");
      }
      onChange(path);
      toast.success(isImage ? "Image uploaded" : "File uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const src = value ? (value.startsWith("http") ? value : `/api/img/${value}`) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-md border bg-muted">
        {src && isImage ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : src ? (
          <span className="px-1 text-center text-[10px] text-muted-foreground">File</span>
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : value ? "Replace" : label || "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
