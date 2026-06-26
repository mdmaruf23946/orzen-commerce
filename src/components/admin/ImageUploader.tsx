// Upload an image to private bucket store-assets/{storeId}/...
// Stores the storage path and renders via /api/img/{path}.
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function ImageUploader({
  storeId,
  value,
  onChange,
}: {
  storeId: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      onChange(path);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const src = value ? (value.startsWith("http") ? value : `/api/img/${value}`) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-md border bg-muted">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
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
