import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Truck, Upload, Trash2, ExternalLink } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { listCouriers, upsertCourier, deleteCourier } from "@/lib/owner-ext.functions";

export const Route = createFileRoute("/_authenticated/owner/courier-brand-assets")({
  component: CourierBrandAssetsPage,
});

type Courier = {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  dark_logo_url: string | null;
  favicon_url: string | null;
  wordmark_url: string | null;
  brand_color: string | null;
  secondary_color: string | null;
  icon_bg_color: string | null;
  description: string | null;
  website_url: string | null;
  docs_url: string | null;
  support_url: string | null;
  sort_order: number | null;
  is_active: boolean;
  is_default: boolean;
  base_url: string | null;
  config: Record<string, any>;
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^https?:\/\/.+/i;

function proxied(u: string | null | undefined) {
  if (!u) return null;
  return u.startsWith("http") ? u : `/api/img/${u}`;
}

function PreviewCard({ c }: { c: Courier }) {
  const logo = proxied(c.logo_url);
  const dark = proxied(c.dark_logo_url);
  const wordmark = proxied(c.wordmark_url);
  const color = c.brand_color || "#0F172A";
  const soft = (c.secondary_color || color) + "14";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { label: "Light theme", bgCard: "#ffffff", src: logo, textColor: color },
        { label: "Dark theme", bgCard: "#0B1220", src: dark || logo, textColor: "#F8FAFC" },
      ].map((v) => (
        <div key={v.label} className="rounded-xl border p-3" style={{ background: v.bgCard, borderColor: color + "33" }}>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide" style={{ color: v.bgCard === "#ffffff" ? "#64748b" : "#94a3b8" }}>
            {v.label}
          </div>
          <div className="flex items-center gap-3 rounded-lg p-2" style={{ background: soft }}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
              {v.src ? (
                <img src={v.src} alt={c.name} className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm font-bold" style={{ color }}>
                  {(c.name || "?").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {wordmark ? (
                  <img src={wordmark} alt={c.name} className="h-5 max-w-[160px] object-contain" style={{ filter: v.bgCard === "#ffffff" ? "none" : "brightness(0) invert(1)" }} />
                ) : (
                  <div className="truncate text-sm font-semibold" style={{ color: v.textColor }}>{c.name || "Untitled courier"}</div>
                )}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: c.is_active ? "#DCFCE7" : "#FEE2E2",
                    color: c.is_active ? "#166534" : "#991B1B",
                  }}
                >
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="truncate text-[11px]" style={{ color: v.bgCard === "#ffffff" ? "#64748b" : "#94a3b8" }}>
                {c.description || "Set a short description in the fields below."}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const v = value || "#000000";
  const invalid = value && !HEX.test(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX.test(v) ? v : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent"
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className={"font-mono text-xs " + (invalid ? "border-destructive" : "")}
        />
      </div>
    </div>
  );
}

async function uploadLogo(file: File, code: string, kind: "logo" | "dark" | "favicon" | "wordmark") {
  const ok = ["image/svg+xml", "image/png", "image/webp"];
  if (!ok.includes(file.type)) throw new Error("Only SVG, PNG or WebP allowed");
  if (file.size > 2 * 1024 * 1024) throw new Error("Max 2MB per file");

  // Dimension check for raster images
  if (file.type !== "image/svg+xml") {
    const dim = await new Promise<{ w: number; h: number }>((res, rej) => {
      const img = new Image();
      img.onload = () => res({ w: img.width, h: img.height });
      img.onerror = () => rej(new Error("Unable to read image"));
      img.src = URL.createObjectURL(file);
    });
    const minEdge = kind === "favicon" ? 32 : kind === "wordmark" ? 40 : 64;
    if (Math.min(dim.w, dim.h) < minEdge) {
      throw new Error(`Image too small — minimum ${minEdge}px shortest edge`);
    }
  }

  const maxEdge = kind === "favicon" ? 128 : kind === "wordmark" ? 640 : 512;
  const toUpload =
    file.type === "image/svg+xml"
      ? file
      : await compressImage(file, { maxEdge, quality: 0.92 });
  const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/webp" ? "webp" : "png";
  const safe = code.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand";
  const path = `brand-logos/courier/${safe}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(path, toUpload, { upsert: true, contentType: toUpload.type });
  if (error) throw new Error(error.message);
  return path;
}

function LogoField({
  label,
  hint,
  code,
  kind,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  code: string;
  kind: "logo" | "dark" | "favicon" | "wordmark";
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const src = proxied(value);
  async function handle(f: File) {
    setBusy(true);
    try {
      const path = await uploadLogo(f, code, kind);
      onChange(path);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3 rounded-lg border p-2">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-[conic-gradient(at_top_left,_#f1f5f9_25%,_#e2e8f0_25%_50%,_#f1f5f9_50%_75%,_#e2e8f0_75%)]">
          {src ? <img src={src} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-[10px] text-muted-foreground">Empty</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">{hint}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/svg+xml,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
              />
            </label>
            {value && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange(null)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CourierEditor({
  initial,
  onSaved,
  onDeleted,
}: {
  initial: Courier;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const save = useServerFn(upsertCourier);
  const del = useServerFn(deleteCourier);
  const [c, setC] = useState<Courier>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setC(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(initial), [c, initial]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!c.name?.trim()) e.name = "Required";
    if (c.brand_color && !HEX.test(c.brand_color)) e.brand_color = "Invalid hex";
    if (c.secondary_color && !HEX.test(c.secondary_color)) e.secondary_color = "Invalid hex";
    if (c.icon_bg_color && !HEX.test(c.icon_bg_color)) e.icon_bg_color = "Invalid hex";
    for (const k of ["website_url", "docs_url", "support_url"] as const) {
      const v = c[k];
      if (v && !URL_RE.test(v)) e[k] = "Must start with http(s)://";
    }
    return e;
  }, [c]);

  async function handleSave() {
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: c.id,
          name: c.name.trim(),
          code: c.code,
          base_url: c.base_url,
          clear_api_key: false,
          logo_url: c.logo_url,
          dark_logo_url: c.dark_logo_url,
          favicon_url: c.favicon_url,
          wordmark_url: c.wordmark_url,
          is_default: c.is_default,
          is_active: c.is_active,
          brand_color: c.brand_color,
          secondary_color: c.secondary_color,
          icon_bg_color: c.icon_bg_color,
          description: c.description,
          website_url: c.website_url || null,
          docs_url: c.docs_url || null,
          support_url: c.support_url || null,
          sort_order: c.sort_order ?? 100,
          config: c.config ?? {},
        },
      });
      toast.success("Branding saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${c.name}"? Store configurations for this courier will remain but the entry will be removed.`)) return;
    setDeleting(true);
    try {
      await del({ data: { id: c.id } });
      toast.success("Courier removed");
      onDeleted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{c.name || "Untitled courier"}</div>
          <div className="text-xs text-muted-foreground">Code: <span className="font-mono">{c.code}</span></div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{c.is_active ? "Active" : "Inactive"}</span>
          <Switch checked={c.is_active} onCheckedChange={(v) => setC({ ...c, is_active: v })} />
        </label>
      </div>

      <PreviewCard c={c} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Courier name</Label>
          <Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          {errors.name && <div className="text-xs text-destructive">{errors.name}</div>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Display order</Label>
          <Input
            type="number"
            value={c.sort_order ?? 100}
            onChange={(e) => setC({ ...c, sort_order: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LogoField
            label="Icon logo"
            hint="Square profile logo. SVG/PNG, max 2MB. Shortest edge ≥ 64px."
            code={c.code}
            kind="logo"
            value={c.logo_url}
            onChange={(v) => setC({ ...c, logo_url: v })}
          />
          <LogoField
            label="Name logo (wordmark)"
            hint="Horizontal brand name logo. Shown beside provider name in the store panel. Transparent PNG/SVG recommended."
            code={c.code}
            kind="wordmark"
            value={c.wordmark_url}
            onChange={(v) => setC({ ...c, wordmark_url: v })}
          />
          <LogoField
            label="Dark / monochrome logo"
            hint="Used on dark backgrounds. Optional."
            code={c.code}
            kind="dark"
            value={c.dark_logo_url}
            onChange={(v) => setC({ ...c, dark_logo_url: v })}
          />
          <LogoField
            label="Favicon / small icon"
            hint="Square icon for compact UI. Optional."
            code={c.code}
            kind="favicon"
            value={c.favicon_url}
            onChange={(v) => setC({ ...c, favicon_url: v })}
          />
        </div>

        <ColorField label="Brand color" value={c.brand_color} onChange={(v) => setC({ ...c, brand_color: v })} />
        <ColorField label="Secondary color" value={c.secondary_color} onChange={(v) => setC({ ...c, secondary_color: v })} />
        <ColorField label="Icon background" value={c.icon_bg_color} onChange={(v) => setC({ ...c, icon_bg_color: v })} />

        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Official description</Label>
          <Textarea
            rows={2}
            value={c.description ?? ""}
            onChange={(e) => setC({ ...c, description: e.target.value })}
            placeholder="Short tagline shown next to the logo in merchant cards."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Official website</Label>
          <Input
            placeholder="https://…"
            value={c.website_url ?? ""}
            onChange={(e) => setC({ ...c, website_url: e.target.value })}
          />
          {errors.website_url && <div className="text-xs text-destructive">{errors.website_url}</div>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Documentation URL</Label>
          <Input
            placeholder="https://…"
            value={c.docs_url ?? ""}
            onChange={(e) => setC({ ...c, docs_url: e.target.value })}
          />
          {errors.docs_url && <div className="text-xs text-destructive">{errors.docs_url}</div>}
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Support URL</Label>
          <Input
            placeholder="https://…"
            value={c.support_url ?? ""}
            onChange={(e) => setC({ ...c, support_url: e.target.value })}
          />
          {errors.support_url && <div className="text-xs text-destructive">{errors.support_url}</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {c.website_url && (
            <a href={c.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" /> Site
            </a>
          )}
          {c.docs_url && (
            <a href={c.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" /> Docs
            </a>
          )}
          {c.support_url && (
            <a href={c.support_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" /> Support
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDeleted && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive">
              {deleting ? "Removing…" : "Remove"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save branding" : "Saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddCourierDialog({ onCreated }: { onCreated: () => void }) {
  const save = useServerFn(upsertCourier);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim() || !code.trim()) return toast.error("Name and code are required");
    setBusy(true);
    try {
      await save({
        data: {
          name: name.trim(),
          code: code.trim().toLowerCase(),
          clear_api_key: false,
          is_active: true,
          is_default: false,
          sort_order: 100,
          config: {},
        },
      });
      toast.success("Courier added");
      setOpen(false);
      setName("");
      setCode("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add courier");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" /> Add courier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new courier provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sundarban Courier" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase())}
                placeholder="sundarban"
              />
              <div className="text-[11px] text-muted-foreground">
                Lowercase, no spaces. Used to identify the courier in configuration.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CourierBrandAssetsPage() {
  const list = useServerFn(listCouriers);
  const qc = useQueryClient();
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["owner", "courier-brand-assets"],
    queryFn: () => list(),
  });

  const rows = useMemo<Courier[]>(() => {
    return ((data as any[]) ?? [])
      .map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        logo_url: r.logo_url ?? null,
        dark_logo_url: r.dark_logo_url ?? null,
        favicon_url: r.favicon_url ?? null,
        wordmark_url: r.wordmark_url ?? null,
        brand_color: r.brand_color ?? null,
        secondary_color: r.secondary_color ?? null,
        icon_bg_color: r.icon_bg_color ?? null,
        description: r.description ?? null,
        website_url: r.website_url ?? null,
        docs_url: r.docs_url ?? null,
        support_url: r.support_url ?? null,
        sort_order: r.sort_order ?? 100,
        is_active: !!r.is_active,
        is_default: !!r.is_default,
        base_url: r.base_url ?? null,
        config: r.config ?? {},
      }))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.name.localeCompare(b.name));
  }, [data]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "courier-brand-assets"] });
    qc.invalidateQueries({ queryKey: ["courier-providers-public"] });
    refetch();
  }

  return (
    <div>
      <OwnerPageHeader
        title="Courier Brand Assets"
        description="Centrally manage every courier's logo, colors, links and status. Merchants automatically inherit these values and cannot edit branding."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {rows.length} courier{rows.length === 1 ? "" : "s"} · sorted by display order
        </div>
        <AddCourierDialog onCreated={invalidate} />
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-10 text-center">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <div className="font-medium">No courier providers yet</div>
          <div className="max-w-md text-xs text-muted-foreground">
            Add your first courier provider to start managing branding. Any provider added here becomes available to every store instantly.
          </div>
          <AddCourierDialog onCreated={invalidate} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => (
            <CourierEditor key={c.id} initial={c} onSaved={invalidate} onDeleted={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}
