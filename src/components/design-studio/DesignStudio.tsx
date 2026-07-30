// ORZEN Design Studio shell (Store Admin). Wraps the existing invoice
// template CRUD — no API, route or data-shape changes.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  deleteInvoiceTemplate,
  duplicateInvoiceTemplate,
  listInvoiceTemplates,
  saveInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/lib/invoice-templates.functions";
import { DEFAULT_BRAND, EMPTY_CANVAS, type Brand, type InvoiceCanvas } from "@/lib/invoice-template/types";
import { KIND_MAP, canvasKind, type DesignKind } from "@/lib/design-studio/registry";
import { StudioSidebar, type StudioView } from "./StudioSidebar";
import { ComingSoonDialog } from "./ComingSoonDialog";
import { StudioDashboard } from "./StudioDashboard";
import { MyDesigns } from "./MyDesigns";
import { BrandKit } from "./BrandKit";
import { StudioEditor } from "./StudioEditor";

type Draft = {
  id?: string;
  name: string;
  description?: string | null;
  canvas: InvoiceCanvas;
  brand: Brand;
};

function blankDraft(kind: DesignKind): Draft {
  const def = KIND_MAP[kind];
  const preset = def.presets[0];
  const base = structuredClone(EMPTY_CANVAS);
  return {
    name: `Untitled ${def.short.toLowerCase()}`,
    canvas: {
      ...base,
      page: { ...base.page, width: preset.width, height: preset.height, kind, preset: preset.id } as any,
    },
    brand: { ...DEFAULT_BRAND },
  };
}

export function DesignStudio() {
  const list = useServerFn(listInvoiceTemplates);
  const save = useServerFn(saveInvoiceTemplate);
  const del = useServerFn(deleteInvoiceTemplate);
  const dup = useServerFn(duplicateInvoiceTemplate);
  const setDefault = useServerFn(setDefaultInvoiceTemplate);
  const qc = useQueryClient();

  const [view, setView] = useState<StudioView>("dashboard");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const { data } = useQuery({ queryKey: ["invoice-templates"], queryFn: () => list() });
  const templates = (data?.templates ?? []) as any[];
  const mine = useMemo(() => templates.filter((t) => t.scope === "store"), [templates]);
  const globals = useMemo(() => templates.filter((t) => t.scope === "global"), [templates]);

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          scope: "store",
          name: d.name,
          description: d.description ?? null,
          canvas: d.canvas,
          brand: d.brand,
        } as any,
      }),
    onSuccess: (r: any) => {
      toast.success("Design saved");
      setDraft((d) => (d ? { ...d, id: d.id ?? r?.id } : d));
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openTemplate = (t: any) =>
    setDraft({ id: t.id, name: t.name, description: t.description, canvas: t.canvas, brand: t.brand });

  const create = (kind: DesignKind) => {
    setDraft(blankDraft(kind));
    setView(kind);
  };

  function selectView(v: StudioView) {
    setNavOpen(false);
    setView(v);
    if (v === "dashboard" || v === "designs" || v === "brand") {
      setDraft(null);
    } else if (!draft || canvasKind(draft.canvas) !== v) {
      const existing = mine.find((t) => canvasKind(t.canvas) === v);
      existing ? openTemplate(existing) : create(v as DesignKind);
    }
  }

  const nav = (
    <StudioSidebar view={view} onView={selectView} onComingSoon={(l) => { setNavOpen(false); setComingSoon(l); }} />
  );

  let body: React.ReactNode;
  if (draft) {
    body = (
      <StudioEditor
        value={draft}
        onChange={(v) => setDraft({ ...draft, ...v })}
        onSave={() => saveMut.mutate(draft)}
        onSaveAs={() => saveMut.mutate({ ...draft, id: undefined, name: `${draft.name} copy` })}
        onBack={() => { setDraft(null); setView("designs"); }}
        saving={saveMut.isPending}
      />
    );
  } else if (view === "designs") {
    body = (
      <MyDesigns
        templates={mine}
        presets={globals}
        onOpen={openTemplate}
        onCreate={create}
        onDuplicate={async (t) => { await dup({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Duplicated"); }}
        onDelete={async (t) => { await del({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Deleted"); }}
        onSetDefault={async (t) => { await setDefault({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Default updated"); }}
        onUsePreset={async (t) => { await dup({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Copied to your store"); }}
      />
    );
  } else if (view === "brand") {
    body = <BrandKit templates={mine} onOpen={openTemplate} />;
  } else {
    body = (
      <StudioDashboard
        templates={mine}
        onCreate={create}
        onOpen={openTemplate}
        onViewAll={() => setView("designs")}
      />
    );
  }

  return (
    <div className="flex gap-4">
      <aside className="sticky top-4 hidden h-[calc(100vh-6rem)] w-56 shrink-0 overflow-hidden rounded-2xl border bg-card shadow-sm lg:block">
        {nav}
      </aside>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="lg:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="mr-1 h-4 w-4" /> Studio menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] max-w-xs p-0">
              <div className="h-full pt-6">{nav}</div>
            </SheetContent>
          </Sheet>
        </div>
        {body}
      </div>

      <ComingSoonDialog open={!!comingSoon} feature={comingSoon} onOpenChange={(v) => !v && setComingSoon(null)} />
    </div>
  );
}
