import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  EyeOff,
  Grid2X2,
  History,
  LayoutList,
  Plus,
  Printer,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TemplateBuilder, PAGE_PRESETS } from "@/components/invoice/builder/TemplateBuilder";
import { InvoiceRenderer } from "@/components/invoice/InvoiceRenderer";
import { GlobalInvoiceInfo } from "@/components/invoice/GlobalInvoiceInfo";
import {
  deleteInvoiceTemplate,
  duplicateInvoiceTemplate,
  listInvoiceTemplateVersions,
  listInvoiceTemplates,
  restoreInvoiceTemplateVersion,
  saveInvoiceTemplate,
  setDefaultInvoiceTemplate,
  setInvoiceTemplateVisibility,
} from "@/lib/invoice-templates.functions";
import { DEFAULT_BRAND, EMPTY_CANVAS, type Brand, type InvoiceCanvas } from "@/lib/invoice-template/types";
import { SAMPLE_INVOICE } from "@/lib/invoice-template/data";

const CATEGORIES = ["general", "modern", "corporate", "colorful", "luxury", "minimal", "receipt"];

type Draft = {
  id?: string;
  name: string;
  description?: string | null;
  canvas: InvoiceCanvas;
  brand: Brand;
  category?: string;
  page_size?: string;
};

/** Small non-interactive preview of a template canvas. */
function TemplateThumb({ canvas, brand, height = 190 }: { canvas: any; brand: any; height?: number }) {
  const w = canvas?.page?.width ?? 794;
  const h = canvas?.page?.height ?? 1123;
  const scale = height / h;
  return (
    <div className="flex justify-center overflow-hidden rounded-lg border bg-neutral-100 p-2 dark:bg-neutral-800">
      <div className="relative bg-white shadow-sm" style={{ width: w * scale, height: h * scale }}>
        <InvoiceRenderer canvas={canvas} brand={brand} data={SAMPLE_INVOICE} scale={scale} />
      </div>
    </div>
  );
}

export function InvoiceTemplatesManager({ scope }: { scope: "global" | "store" }) {
  const list = useServerFn(listInvoiceTemplates);
  const save = useServerFn(saveInvoiceTemplate);
  const del = useServerFn(deleteInvoiceTemplate);
  const dup = useServerFn(duplicateInvoiceTemplate);
  const setDefault = useServerFn(setDefaultInvoiceTemplate);
  const setVisibility = useServerFn(setInvoiceTemplateVisibility);
  const listVersions = useServerFn(listInvoiceTemplateVersions);
  const restoreVersion = useServerFn(restoreInvoiceTemplateVersion);
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [previewOf, setPreviewOf] = useState<any | null>(null);
  const [previewSize, setPreviewSize] = useState("a4");
  const [versionsFor, setVersionsFor] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["invoice-templates"], queryFn: () => list() });
  const templates = (data?.templates ?? []) as any[];

  const versionsQuery = useQuery({
    queryKey: ["invoice-template-versions", versionsFor],
    queryFn: () => listVersions({ data: { templateId: versionsFor! } }),
    enabled: !!versionsFor,
  });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          scope,
          name: d.name,
          description: d.description ?? null,
          canvas: d.canvas,
          brand: d.brand,
          category: d.category ?? "general",
          page_size: d.page_size ?? "a4",
        } as any,
      }),
    onSuccess: (r: any) => {
      toast.success("Template saved");
      setDraft((d) => (d ? { ...d, id: d.id ?? r?.id } : d));
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mine = useMemo(() => {
    let rows = templates.filter((t) => t.scope === scope);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter((t) => `${t.name} ${t.description ?? ""}`.toLowerCase().includes(s));
    }
    if (category !== "all") rows = rows.filter((t) => (t.category ?? "general") === category);
    if (status !== "all") rows = rows.filter((t) => (status === "hidden" ? t.is_hidden : !t.is_hidden));
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "usage") return (b.usage_count ?? 0) - (a.usage_count ?? 0);
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
    return rows;
  }, [templates, scope, q, category, status, sort]);

  const globals = templates.filter((t) => t.scope === "global" && !t.is_hidden);

  function openEditor(t?: any) {
    setDraft(
      t
        ? {
            id: t.id,
            name: t.name,
            description: t.description,
            canvas: t.canvas,
            brand: t.brand,
            category: t.category ?? "general",
            page_size: t.page_size ?? "a4",
          }
        : {
            name: "Untitled template",
            canvas: structuredClone(EMPTY_CANVAS),
            brand: { ...DEFAULT_BRAND },
            category: "general",
            page_size: "a4",
          },
    );
  }

  // ---- Store Admin: pick a design + manage global invoice information ----
  if (scope === "store") {
    const own = templates.filter((t) => t.scope === "store");
    const active = own.find((t) => t.is_default) ?? null;
    const activeSource = active?.source_template_id ?? active?.id ?? null;
    const choices = [
      ...own.filter((t) => !t.source_template_id),
      ...globals.map((g) => {
        const copy = own.find((t) => t.source_template_id === g.id);
        return copy ? { ...copy, name: g.name, description: g.description } : g;
      }),
    ];
    const filtered = q.trim()
      ? choices.filter((t) => `${t.name} ${t.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      : choices;

    async function activate(t: any) {
      let id = t.id;
      if (t.scope === "global") {
        const r: any = await dup({ data: { id: t.id } });
        id = r?.id;
      }
      await setDefault({ data: { id } });
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success("Template activated");
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Invoice Templates</h1>
          <p className="text-sm text-muted-foreground">
            Choose an invoice design. Your business details come from Global Invoice Information below.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t: any) => {
            const isActive = !!activeSource && (t.id === activeSource || t.id === active?.id);
            return (
              <div key={t.id} className={cn("rounded-xl border bg-card p-4", isActive && "ring-2 ring-primary")}>
                <TemplateThumb canvas={t.canvas} brand={t.brand} height={190} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{t.name}</span>
                  {isActive && <Badge>Active</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setPreviewOf(t); setPreviewSize(t.page_size ?? "a4"); }}>
                    <Eye className="mr-1 h-4 w-4" /> Preview
                  </Button>
                  <Button size="sm" disabled={isActive} onClick={() => activate(t)}>
                    <Star className="mr-1 h-4 w-4" /> {isActive ? "Active" : "Set active"}
                  </Button>
                </div>
              </div>
            );
          })}
          {!filtered.length && <p className="text-sm text-muted-foreground">No templates available yet.</p>}
        </div>

        <GlobalInvoiceInfo />

        <Dialog open={!!previewOf} onOpenChange={(o) => !o && setPreviewOf(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
            <DialogHeader><DialogTitle>{previewOf?.name}</DialogTitle></DialogHeader>
            {previewOf && <TemplateThumb canvas={previewOf.canvas} brand={previewOf.brand} height={640} />}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>← Back to templates</Button>
          <Select value={draft.category ?? "general"} onValueChange={(v) => setDraft({ ...draft, category: v })}>
            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <TemplateBuilder
          value={draft}
          onChange={(v) => setDraft({ ...draft, ...v })}
          onSave={() => saveMut.mutate(draft)}
          saving={saveMut.isPending}
          pageSize={draft.page_size ?? "a4"}
          onPageSizeChange={(v) => setDraft((d) => (d ? { ...d, page_size: v } : d))}
          onOpenVersions={draft.id ? () => setVersionsFor(draft.id!) : undefined}
        />

        <Dialog open={!!versionsFor} onOpenChange={(o) => !o && setVersionsFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Version history</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-80 pr-2">
              <div className="space-y-2">
                {(versionsQuery.data?.versions ?? []).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{v.name ?? "Snapshot"}{v.label ? ` · ${v.label}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setDraft((d) => (d ? { ...d, canvas: v.canvas, brand: v.brand } : d));
                        await restoreVersion({ data: { templateId: versionsFor!, versionId: v.id } });
                        qc.invalidateQueries({ queryKey: ["invoice-templates"] });
                        setVersionsFor(null);
                        toast.success("Version restored");
                      }}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
                {!versionsQuery.isLoading && !(versionsQuery.data?.versions ?? []).length && (
                  <p className="text-sm text-muted-foreground">No saved versions yet.</p>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoice Templates</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "global"
              ? "Global presets available to every store."
              : "Your store's invoice designs. Duplicate a preset to customise it."}
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="usage">Most used</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border">
          <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} className="h-9 rounded-r-none" onClick={() => setView("grid")}>
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="h-9 rounded-l-none" onClick={() => setView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3")}>
        {mine.map((t) => (
          <div key={t.id} className={cn("rounded-xl border bg-card p-4", view === "list" && "flex flex-wrap items-center gap-4")}>
            <div className={cn(view === "list" ? "w-28 shrink-0" : "mb-3")}>
              <TemplateThumb canvas={t.canvas} brand={t.brand} height={view === "list" ? 90 : 190} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{t.name}</span>
                {t.is_default && <Badge variant="secondary">Default</Badge>}
                <Badge variant={t.is_hidden ? "outline" : "default"}>{t.is_hidden ? "Hidden" : "Active"}</Badge>
                <Badge variant="outline" className="capitalize">{t.category ?? "general"}</Badge>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Used by {t.usage_count ?? 0} store{(t.usage_count ?? 0) === 1 ? "" : "s"} · {PAGE_PRESETS[t.page_size ?? "a4"]?.label ?? "A4"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditor(t)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { setPreviewOf(t); setPreviewSize(t.page_size ?? "a4"); }}>
                  <Eye className="mr-1 h-4 w-4" /> Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => setVersionsFor(t.id)}>
                  <History className="mr-1 h-4 w-4" /> History
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await setVisibility({ data: { id: t.id, hidden: !t.is_hidden } });
                    qc.invalidateQueries({ queryKey: ["invoice-templates"] });
                  }}
                >
                  {t.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => { await del({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Deleted"); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!mine.length && <p className="text-sm text-muted-foreground">No templates match your filters.</p>}
      </div>


      {/* Preview dialog */}
      <Dialog open={!!previewOf} onOpenChange={(o) => !o && setPreviewOf(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
          <DialogHeader><DialogTitle>{previewOf?.name}</DialogTitle></DialogHeader>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Label className="text-xs">Page</Label>
            <Select value={previewSize} onValueChange={setPreviewSize}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAGE_PRESETS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print preview
            </Button>
          </div>
          {previewOf && (
            <TemplateThumb
              canvas={{
                ...previewOf.canvas,
                page: { ...previewOf.canvas.page, ...(PAGE_PRESETS[previewSize] ?? {}) },
              }}
              brand={previewOf.brand}
              height={640}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Version history from card */}
      <Dialog open={!!versionsFor && !draft} onOpenChange={(o) => !o && setVersionsFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Version history</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-80 pr-2">
            <div className="space-y-2">
              {(versionsQuery.data?.versions ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{v.name ?? "Snapshot"}{v.label ? ` · ${v.label}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await restoreVersion({ data: { templateId: versionsFor!, versionId: v.id } });
                      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
                      setVersionsFor(null);
                      toast.success("Version restored");
                    }}
                  >
                    Restore
                  </Button>
                </div>
              ))}
              {!versionsQuery.isLoading && !(versionsQuery.data?.versions ?? []).length && (
                <p className="text-sm text-muted-foreground">No saved versions yet.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
