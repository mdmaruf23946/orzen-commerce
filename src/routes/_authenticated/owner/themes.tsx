import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ownerListThemes,
  ownerSetThemeStatus,
  ownerDuplicateTheme,
  ownerDeleteTheme,
} from "@/lib/themes.functions";
import { mergeTheme } from "@/lib/theme/definition";
import { Button } from "@/components/ui/button";
import { ThemeEditorDrawer, type OwnerThemeRow } from "@/components/owner/ThemeEditorDrawer";


export const Route = createFileRoute("/_authenticated/owner/themes")({
  component: OwnerThemes,
  head: () => ({
    meta: [
      { title: "Store Themes — ORZEN Admin" },
      { name: "description", content: "Create, publish and manage the storefront themes every ORZEN store can choose from." },
      { property: "og:title", content: "Store Themes — ORZEN Admin" },
      { property: "og:description", content: "Manage the global storefront theme catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OwnerThemes() {
  const qc = useQueryClient();
  const listFn = useServerFn(ownerListThemes);
  const statusFn = useServerFn(ownerSetThemeStatus);
  const dupFn = useServerFn(ownerDuplicateTheme);
  const delFn = useServerFn(ownerDeleteTheme);

  const { data: themes = [], isLoading } = useQuery({ queryKey: ["owner", "themes"], queryFn: () => listFn() });
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["owner", "themes"] }); };

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "draft" | "published" | "hidden" }) => statusFn({ data: v }),
    onSuccess: () => done("Status updated"),
    onError: (e: any) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => done("Theme duplicated"),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => done("Theme deleted"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <header className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Store Themes</h1>
        <p className="text-sm text-muted-foreground">
          Themes published here appear in every store admin's Theme Customization page.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading themes…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((t: any) => {
            const d = mergeTheme(t.definition, {});
            return (
              <div key={t.id} className="min-w-0 rounded-xl border bg-card p-3">
                <div className="flex h-16 overflow-hidden rounded-lg border">
                  <span className="w-1/4" style={{ background: d.colors.header }} />
                  <span className="w-1/4" style={{ background: d.colors.primary }} />
                  <span className="w-1/4" style={{ background: d.colors.accent }} />
                  <span className="w-1/4" style={{ background: d.colors.footer }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{t.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] capitalize ${
                    t.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>{t.status}</span>
                </div>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {t.category} · used by {t.used_by} store{t.used_by === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setStatus.mutate({ id: t.id, status: t.status === "published" ? "hidden" : "published" })}
                  >
                    {t.status === "published" ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    {t.status === "published" ? "Hide" : "Publish"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(t.id)}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (confirm(`Delete "${t.name}"?`)) remove.mutate(t.id); }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" />
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
