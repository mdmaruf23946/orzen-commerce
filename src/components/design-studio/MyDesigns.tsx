import { useState } from "react";
import { Copy, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KINDS, KIND_MAP, canvasKind, type DesignKind } from "@/lib/design-studio/registry";

export function MyDesigns({
  templates,
  presets,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
  onSetDefault,
  onUsePreset,
}: {
  templates: any[];
  presets: any[];
  onOpen: (t: any) => void;
  onCreate: (kind: DesignKind) => void;
  onDuplicate: (t: any) => void;
  onDelete: (t: any) => void;
  onSetDefault: (t: any) => void;
  onUsePreset: (t: any) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const rows = templates.filter(
    (t) =>
      (filter === "all" || canvasKind(t.canvas) === filter) &&
      String(t.name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">My Designs</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Every design saved for your store.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs" className="h-9 w-40 pl-8 sm:w-56" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.short}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => onCreate("invoice")}><Plus className="mr-1 h-4 w-4" /> New</Button>
        </div>
      </div>

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const k = KIND_MAP[canvasKind(t.canvas)];
            return (
              <div key={t.id} className="group rounded-2xl border bg-card p-4 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <k.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {k.short} · {t.canvas?.elements?.length ?? 0} layers
                    </div>
                  </div>
                  {t.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onOpen(t)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(t)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                  {!t.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => onSetDefault(t)} title="Set default"><Star className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(t)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No designs match your filters.
        </div>
      )}

      {presets.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Ready-made presets</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {presets.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-card p-4">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="mb-3 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
                <Button size="sm" variant="outline" onClick={() => onUsePreset(t)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Use this
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
