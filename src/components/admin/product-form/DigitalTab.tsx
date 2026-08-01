import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, ExternalLink, KeyRound, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addLicenseKeys,
  deleteLicenseKey,
  deleteProductFile,
  listLicenseKeys,
  listProductFiles,
  saveProductFile,
  signOwnerFile,
} from "@/lib/digital.functions";
import { DEFAULT_DIGITAL, DIGITAL_ACCEPT, normalizeDigital, prettySize, type DigitalConfig } from "@/lib/digital";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_MB = 200;

export function DigitalTab({
  productId,
  storeId,
  digital,
  digitalCategory,
  onChange,
}: {
  productId?: string;
  storeId: string;
  digital: any;
  digitalCategory?: string | null;
  onChange: (d: DigitalConfig) => void;
}) {
  const cfg = normalizeDigital(digital ?? DEFAULT_DIGITAL);
  const set = <K extends keyof DigitalConfig>(k: K, v: DigitalConfig[K]) =>
    onChange({ ...cfg, [k]: v });

  return (
    <div className="space-y-5">
      {productId && (
        <CategoryPicker productId={productId} value={digitalCategory ?? null} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Delivery</Label>
          <select
            value={cfg.delivery}
            onChange={(e) => set("delivery", e.target.value as DigitalConfig["delivery"])}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="instant">Instant — unlock as soon as payment is confirmed</option>
            <option value="manual">Manual — you release the files yourself</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Download limit per file</Label>
          <Input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={cfg.download_limit ?? ""}
            onChange={(e) => set("download_limit", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Access expires after (days)</Label>
          <Input
            type="number"
            min={1}
            placeholder="Never"
            value={cfg.expiry_days ?? ""}
            onChange={(e) => set("expiry_days", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <label className="flex items-center justify-between gap-3 self-end rounded-lg border p-3">
          <span className="text-sm font-medium">Attach a license key</span>
          <Switch checked={cfg.license_enabled} onCheckedChange={(v) => set("license_enabled", v)} />
        </label>
      </div>

      <div className="space-y-1.5">
        <Label>Buyer instructions</Label>
        <Textarea
          rows={3}
          maxLength={2000}
          placeholder="Installation steps, activation notes, support contact…"
          value={cfg.instructions ?? ""}
          onChange={(e) => set("instructions", e.target.value || null)}
        />
      </div>

      {!productId ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Save the product first, then reopen it to upload files and license keys.
        </div>
      ) : (
        <>
          <FilesManager productId={productId} storeId={storeId} />
          {cfg.license_enabled && <LicenseManager productId={productId} />}
        </>
      )}
    </div>
  );
}

function CategoryPicker({ productId, value }: { productId: string; value: string | null }) {
  const listCatalog = useServerFn(listDigitalCatalog);
  const save = useServerFn(setProductDigitalCategory);
  const [key, setKey] = useState<string>(value ?? "");
  const catsQ = useQuery({ queryKey: ["digital-catalog"], queryFn: () => listCatalog({}) });
  const cats = ((catsQ.data ?? []) as any[]).filter((c) => c.is_active);

  return (
    <div className="space-y-1.5">
      <Label>Digital category</Label>
      <select
        value={key}
        onChange={async (e) => {
          const v = e.target.value;
          setKey(v);
          try {
            await save({ data: { productId, key: v || null } });
            toast.success("Category updated");
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Uncategorised</option>
        {cats.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">
        Used by the digital storefront filters and category grid.
      </p>
    </div>
  );
}

function FilesManager({ productId, storeId }: { productId: string; storeId: string }) {

  const qc = useQueryClient();
  const list = useServerFn(listProductFiles);
  const saveFile = useServerFn(saveProductFile);
  const delFile = useServerFn(deleteProductFile);
  const signFile = useServerFn(signOwnerFile);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const filesQ = useQuery({
    queryKey: ["product-files", productId],
    queryFn: () => list({ data: { productId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["product-files", productId] });

  async function upload(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File is too large (max ${MAX_MB} MB)`);
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
      const path = `${storeId}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("digital-files").upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw new Error(error.message);
      await saveFile({
        data: {
          productId,
          label: file.name,
          storage_path: path,
          file_type: file.type || ext,
          file_size: file.size,
          sort_order: (filesQ.data?.length ?? 0) + 1,
        },
      });
      await refresh();
      toast.success("File uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkLabel.trim() || !linkUrl.trim()) throw new Error("Label and link are required");
      await saveFile({
        data: {
          productId,
          label: linkLabel.trim(),
          external_url: linkUrl.trim(),
          sort_order: (filesQ.data?.length ?? 0) + 1,
        },
      });
    },
    onSuccess: async () => {
      setLinkLabel("");
      setLinkUrl("");
      await refresh();
      toast.success("Link added");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function preview(id: string) {
    try {
      const { url } = await signFile({ data: { fileId: id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Files & versions</h3>
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={DIGITAL_ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {(filesQ.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No files yet. Upload a PDF, ZIP, video or add an external link (max {MAX_MB} MB per file).
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {(filesQ.data as any[]).map((f) => (
            <li key={f.id} className="flex items-center gap-2 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {f.external_url ? "External link" : prettySize(f.file_size)}
                  {f.version ? ` · v${f.version}` : ""}
                </div>
              </div>
              <Input
                className="h-8 w-24"
                placeholder="Version"
                defaultValue={f.version ?? ""}
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  if (v === (f.version ?? "")) return;
                  await saveFile({ data: { id: f.id, productId, label: f.label, version: v || null, storage_path: f.storage_path, external_url: f.external_url } });
                  refresh();
                }}
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => preview(f.id)} aria-label="Preview">
                {f.external_url ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Delete file"
                onClick={async () => {
                  await delFile({ data: { id: f.id } });
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input placeholder="Link label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
        <Input placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <Button type="button" variant="outline" onClick={() => addLink.mutate()} disabled={addLink.isPending}>
          Add link
        </Button>
      </div>
    </div>
  );
}

function LicenseManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listLicenseKeys);
  const add = useServerFn(addLicenseKeys);
  const del = useServerFn(deleteLicenseKey);
  const [bulk, setBulk] = useState("");

  const keysQ = useQuery({
    queryKey: ["license-keys", productId],
    queryFn: () => list({ data: { productId } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["license-keys", productId] });

  const rows = (keysQ.data ?? []) as any[];
  const available = rows.filter((r) => r.status === "available").length;

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">License keys</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {available} available / {rows.length} total
        </span>
      </div>
      <Textarea
        rows={3}
        placeholder="One key per line"
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          const keys = bulk.split("\n").map((k) => k.trim()).filter(Boolean);
          if (keys.length === 0) return toast.error("Add at least one key");
          try {
            await add({ data: { productId, keys } });
            setBulk("");
            refresh();
            toast.success(`${keys.length} keys added`);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      >
        Add keys
      </Button>

      {rows.length > 0 && (
        <ul className="max-h-52 divide-y overflow-y-auto rounded-lg border text-sm">
          {rows.map((k) => (
            <li key={k.id} className="flex items-center gap-2 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{k.key_value}</code>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  k.status === "available" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {k.status}
              </span>
              {k.status === "available" && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete key"
                  onClick={async () => {
                    await del({ data: { id: k.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
