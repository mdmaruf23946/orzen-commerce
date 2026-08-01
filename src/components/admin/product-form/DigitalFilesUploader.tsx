// Upload digital product files to store-assets/{storeId}/digital/...
import { useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type DigitalFile = {
  path: string;
  name: string;
  size: number;
  type: string;
};

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

export const DIGITAL_ACCEPT =
  ".pdf,.zip,.rar,.7z,.tar,.gz,.mp4,.mp3,.wav,.png,.jpg,.jpeg,.webp,.psd,.ai,.eps,.fig,.sketch,.xd,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.apk,.exe,.dmg,.epub,.ttf,.otf,.json,.txt";

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DigitalFilesUploader({
  storeId,
  value,
  onChange,
  max = 20,
}: {
  storeId: string;
  value: DigitalFile[];
  onChange: (files: DigitalFile[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function upload(files: FileList) {
    const remaining = max - value.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} files`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    const uploaded: DigitalFile[] = [];
    setProgress({ done: 0, total: list.length });
    try {
      let done = 0;
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: too large (max 200 MB)`);
          done++;
          setProgress({ done, total: list.length });
          continue;
        }
        const rawExt = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const ext = rawExt.slice(0, 6) || "bin";
        const path = `${storeId}/digital/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("store-assets").upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });
        if (error) {
          console.error("Digital upload error:", error);
          toast.error(error.message || "Upload failed");
        } else {
          uploaded.push({
            path,
            name: file.name,
            size: file.size,
            type: file.type || ext.toUpperCase(),
          });
        }
        done++;
        setProgress({ done, total: list.length });
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded]);
        toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DIGITAL_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!!progress}
        className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60 disabled:opacity-60"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">
          {progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload digital files"}
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, ZIP, RAR, MP4, MP3, PNG, JPG, PSD, AI, FIG, DOCX, XLSX, PPTX, APK, EXE, source code — max 200 MB each
        </span>
      </button>

      {value.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {value.map((f, i) => (
            <li key={f.path} className="flex items-center gap-3 bg-card p-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(f.size)} · {(f.name.split(".").pop() || "file").toUpperCase()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
