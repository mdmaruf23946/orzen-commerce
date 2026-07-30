import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Star, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateBuilder } from "@/components/invoice/builder/TemplateBuilder";
import {
  deleteInvoiceTemplate,
  duplicateInvoiceTemplate,
  listInvoiceTemplates,
  saveInvoiceTemplate,
  setDefaultInvoiceTemplate,
} from "@/lib/invoice-templates.functions";
import { DEFAULT_BRAND, EMPTY_CANVAS, type Brand, type InvoiceCanvas } from "@/lib/invoice-template/types";

type Draft = {
  id?: string;
  name: string;
  description?: string | null;
  canvas: InvoiceCanvas;
  brand: Brand;
};

export function InvoiceTemplatesManager({ scope }: { scope: "global" | "store" }) {
  const list = useServerFn(listInvoiceTemplates);
  const save = useServerFn(saveInvoiceTemplate);
  const del = useServerFn(deleteInvoiceTemplate);
  const dup = useServerFn(duplicateInvoiceTemplate);
  const setDefault = useServerFn(setDefaultInvoiceTemplate);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data } = useQuery({ queryKey: ["invoice-templates"], queryFn: () => list() });
  const templates = (data?.templates ?? []) as any[];
  const mine = templates.filter((t) => t.scope === scope);
  const globals = templates.filter((t) => t.scope === "global");

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      save({ data: { id: d.id, scope, name: d.name, description: d.description ?? null, canvas: d.canvas, brand: d.brand } as any }),
    onSuccess: (r: any) => {
      toast.success("Template saved");
      setDraft((d) => (d ? { ...d, id: d.id ?? r?.id } : d));
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (draft) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>← Back to templates</Button>
        <TemplateBuilder
          value={draft}
          onChange={(v) => setDraft({ ...draft, ...v })}
          onSave={() => saveMut.mutate(draft)}
          saving={saveMut.isPending}
        />
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
        <Button
          onClick={() =>
            setDraft({ name: "Untitled template", canvas: structuredClone(EMPTY_CANVAS), brand: { ...DEFAULT_BRAND } })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mine.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              {t.is_default && <Badge variant="secondary">Default</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraft({ id: t.id, name: t.name, description: t.description, canvas: t.canvas, brand: t.brand })}>
                Edit
              </Button>
              {scope === "store" && !t.is_default && (
                <Button size="sm" variant="outline" onClick={async () => { await setDefault({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); }}>
                  <Star className="mr-1 h-4 w-4" /> Set default
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => { await del({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Deleted"); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {scope === "store" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ready-made presets</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {globals.map((t) => (
              <div key={t.id} className="rounded-xl border bg-card p-4">
                <div className="font-medium">{t.name}</div>
                <div className="mb-3 text-xs text-muted-foreground">{t.description}</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => { await dup({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["invoice-templates"] }); toast.success("Copied to your store"); }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Use this
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
