import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { listThemes, getMyThemeState, selectStoreTheme, resetStoreTheme } from "@/lib/themes.functions";
import { mergeTheme } from "@/lib/theme/definition";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/theme")({
  component: StoreThemePage,
  head: () => ({
    meta: [
      { title: "Store Theme — Merchant Panel" },
      { name: "description", content: "Choose the published theme your storefront uses." },
      { property: "og:title", content: "Store Theme — Merchant Panel" },
      { property: "og:description", content: "Choose the published theme your storefront uses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StoreThemePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listThemes);
  const stateFn = useServerFn(getMyThemeState);
  const selectFn = useServerFn(selectStoreTheme);
  const resetFn = useServerFn(resetStoreTheme);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ["admin", "themes", "catalog"],
    queryFn: () => listFn(),
  });
  const { data: state } = useQuery({
    queryKey: ["admin", "themes", "mine"],
    queryFn: () => stateFn(),
  });

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin", "themes"] });
  };

  const select = useMutation({
    mutationFn: (themeId: string) => selectFn({ data: { themeId } }),
    onSuccess: () => done("Theme applied to your store"),
    onError: (e: any) => toast.error(e?.message ?? "Could not apply theme"),
  });
  const reset = useMutation({
    mutationFn: () => resetFn({ data: { full: true } }),
    onSuccess: () => done("Restored the default theme"),
    onError: (e: any) => toast.error(e?.message ?? "Reset failed"),
  });

  const activeId = (state as any)?.theme_id ?? null;
  const storeSlug = (state as any)?.slug ?? null;

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Store Theme</h1>
          <p className="text-sm text-muted-foreground">
            Pick one of the published themes for your storefront. Changes apply instantly.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          {reset.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-1 h-4 w-4" />
          )}
          Restore Default Theme
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading themes…</p>
      ) : themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published themes available yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(themes as any[]).map((t) => {
            const d = mergeTheme(t.definition, {});
            const active = t.id === activeId;
            return (
              <div
                key={t.id}
                className={`min-w-0 rounded-xl border bg-card p-3 ${active ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex h-16 overflow-hidden rounded-lg border">
                  <span className="w-1/4" style={{ background: d.colors.header }} />
                  <span className="w-1/4" style={{ background: d.colors.primary }} />
                  <span className="w-1/4" style={{ background: d.colors.accent }} />
                  <span className="w-1/4" style={{ background: d.colors.footer }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{t.name}</span>
                  {active && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  )}
                </div>
                <p className="truncate text-xs capitalize text-muted-foreground">{t.category}</p>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                )}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant={active ? "outline" : "default"}
                    disabled={active || select.isPending}
                    onClick={() => select.mutate(t.id)}
                  >
                    {select.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    {active ? "Current theme" : "Use this theme"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
