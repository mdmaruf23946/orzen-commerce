import { Plus, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KINDS, canvasKind, type DesignKind } from "@/lib/design-studio/registry";

export function StudioDashboard({
  templates,
  onCreate,
  onOpen,
  onViewAll,
}: {
  templates: any[];
  onCreate: (kind: DesignKind) => void;
  onOpen: (t: any) => void;
  onViewAll: () => void;
}) {
  const recent = [...templates]
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/12 via-card to-card p-5 sm:p-7">
        <Badge variant="secondary" className="mb-2 text-[10px]">Origin Studio</Badge>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Design anything for your store</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Invoices, logos, posters and banners — all in one premium editor with your brand kit built in.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onCreate("invoice")}>
            <Plus className="mr-1 h-4 w-4" /> New invoice design
          </Button>
          <Button variant="outline" onClick={onViewAll}>Browse my designs</Button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Start a new design</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onCreate(k.id)}
              className={cn(
                "group rounded-2xl border bg-gradient-to-br p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                k.accent,
              )}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/80 text-primary shadow-sm">
                <k.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold">{k.label}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.description}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                <Plus className="h-3.5 w-3.5" /> Create
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {KINDS.map((k) => {
          const count = templates.filter((t) => canvasKind(t.canvas) === k.id).length;
          return (
            <div key={k.id} className="rounded-2xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{k.short} designs</div>
              <div className="mt-1 text-2xl font-semibold">{count}</div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" /> Continue editing
          </h2>
          <Button variant="ghost" size="sm" onClick={onViewAll}>View all</Button>
        </div>
        {recent.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpen(t)}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {canvasKind(t.canvas)} · {t.canvas?.elements?.length ?? 0} layers
                  </div>
                </div>
                {t.is_default && <Badge variant="secondary" className="ml-auto text-[10px]">Default</Badge>}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No designs yet — create your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
