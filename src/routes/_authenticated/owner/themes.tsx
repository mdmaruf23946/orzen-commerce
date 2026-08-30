import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { ownerListThemes, ownerSetThemeStatus } from "@/lib/themes.functions";
import { mergeTheme } from "@/lib/theme/definition";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/themes")({
  component: OwnerThemes,
  errorComponent: ThemesError,
  head: () => ({
    meta: [
      { title: "Store Themes — ORZEN Admin" },
      { name: "description", content: "Publish or hide the storefront themes every ORZEN store can choose from." },
      { property: "og:title", content: "Store Themes — ORZEN Admin" },
      { property: "og:description", content: "Publish or hide the global storefront theme catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ThemesError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-lg font-semibold">Store Themes could not load</h1>
      <p className="text-sm text-muted-foreground">{error?.message || "Something went wrong."}</p>
      <Button
        size="sm"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("orzen:chunk-reload");
            window.location.reload();
            return;
          }
          router.invalidate();
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

function OwnerThemes() {
  const qc = useQueryClient();
  const listFn = useServerFn(ownerListThemes);
  const statusFn = useServerFn(ownerSetThemeStatus);

  const { data: themes = [], isLoading } = useQuery({ queryKey: ["owner", "themes"], queryFn: () => listFn() });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "draft" | "published" | "hidden" }) => statusFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.status === "published" ? "Theme published" : "Theme hidden");
      qc.invalidateQueries({ queryKey: ["owner", "themes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <header className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Store Themes</h1>
        <p className="text-sm text-muted-foreground">
          Published themes appear in every merchant's Theme page. Hide a theme to remove it from their options.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading themes…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((t: any) => {
            const d = mergeTheme(t.definition, {});
            const published = t.status === "published";
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
                    published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>{t.status}</span>
                </div>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {t.category} · used by {t.used_by} store{t.used_by === 1 ? "" : "s"}
                </p>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: t.id, status: published ? "hidden" : "published" })}
                  >
                    {published ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    {published ? "Hide" : "Publish"}
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
