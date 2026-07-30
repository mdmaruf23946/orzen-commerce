import { Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandPanel } from "@/components/invoice/builder/TemplateBuilder";
import { DEFAULT_BRAND, type Brand } from "@/lib/invoice-template/types";
import { canvasKind } from "@/lib/design-studio/registry";

export function BrandKit({
  templates,
  onOpen,
}: {
  templates: any[];
  onOpen: (t: any) => void;
}) {
  const sample: Brand = { ...DEFAULT_BRAND, ...(templates[0]?.brand ?? {}) };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">Brand Kit</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Brand colours and typography are saved with each design. Open a design to edit its brand tokens.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" /> Current tokens
          </div>
          <div className="pointer-events-none space-y-3 opacity-90">
            <BrandPanel brand={sample} onChange={() => {}} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Read-only preview of your latest design's brand.</p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Designs using your brand</div>
          {templates.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => {
                const b = { ...DEFAULT_BRAND, ...(t.brand ?? {}) };
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t)}
                    className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex gap-1">
                      {[b.primary, b.secondary, b.accent].map((c, i) => (
                        <span key={i} className="h-6 w-3 rounded-sm border" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{canvasKind(t.canvas)}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Edit</Badge>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Create a design to start your brand kit.</p>
          )}
          <Button variant="ghost" size="sm" className="mt-3" disabled>
            Shared brand library — coming soon
          </Button>
        </div>
      </div>
    </div>
  );
}
