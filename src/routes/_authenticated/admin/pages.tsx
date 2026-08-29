import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, FileText, Loader2, Save, Sparkles } from "lucide-react";
import RichTextEditor from "@/components/admin/product-form/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STORE_PAGES } from "@/lib/store-pages";
import {
  listMyStorePages,
  saveMyStorePage,
  generateStarterPage,
} from "@/lib/store-pages.functions";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  head: () => ({
    meta: [
      { title: "Pages & Content — ORZEN Merchant Panel" },
      { name: "description", content: "Write and publish your store's information and policy pages." },
      { property: "og:title", content: "Pages & Content — ORZEN Merchant Panel" },
      { property: "og:description", content: "Write and publish your store's information and policy pages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PagesAdmin,
});

type Draft = {
  title: string;
  content_html: string;
  seo_description: string;
  is_published: boolean;
};

function PagesAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(listMyStorePages);
  const save = useServerFn(saveMyStorePage);
  const generate = useServerFn(generateStarterPage);

  const [activeKey, setActiveKey] = useState(STORE_PAGES[0]!.key);
  const [draft, setDraft] = useState<Draft>({
    title: "",
    content_html: "",
    seo_description: "",
    is_published: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-store-pages"],
    queryFn: () => load({}),
  });

  const def = useMemo(() => STORE_PAGES.find((p) => p.key === activeKey)!, [activeKey]);
  const saved = useMemo(
    () => (data?.pages ?? []).find((p: any) => p.page_key === activeKey),
    [data, activeKey],
  );

  useEffect(() => {
    setDraft({
      title: saved?.title || def.label,
      content_html: saved?.content_html || "",
      seo_description: saved?.seo_description || "",
      is_published: saved?.is_published ?? true,
    });
  }, [activeKey, saved, def.label]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          pageKey: activeKey,
          title: draft.title,
          content_html: draft.content_html,
          seo_description: draft.seo_description || null,
          is_published: draft.is_published,
        },
      }),
    onSuccess: () => {
      toast.success("Page saved");
      qc.invalidateQueries({ queryKey: ["my-store-pages"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save the page"),
  });

  const genMut = useMutation({
    mutationFn: () => generate({ data: { pageKey: activeKey } }),
    onSuccess: (res: any) => {
      setDraft((d) => ({
        ...d,
        title: res.title || d.title,
        content_html: res.html || d.content_html,
        seo_description: res.description || d.seo_description,
      }));
      toast.success("Starter content added — review, then save");
    },
    onError: (e: any) => toast.error(e?.message || "Could not generate content"),
  });

  const slug = data?.store?.slug;
  const publicPath = `/store/${slug}/${activeKey}`;

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-clip p-4 sm:p-6">
      <header className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <FileText className="h-5 w-5 shrink-0 text-primary" /> Pages & Content
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write your About, Contact, Blogs and legal pages. Content is published instantly on your
          storefront footer links.
        </p>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="min-w-0 space-y-4">
          {(["quick", "policy"] as const).map((group) => (
            <div key={group}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group === "quick" ? "Quick Links" : "Customer Policies"}
              </p>
              <div className="space-y-1">
                {STORE_PAGES.filter((p) => p.group === group).map((p) => {
                  const row = (data?.pages ?? []).find((r: any) => r.page_key === p.key);
                  const active = p.key === activeKey;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActiveKey(p.key)}
                      className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary/5 font-semibold text-primary"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0 truncate">{p.label}</span>
                      {row?.content_html ? (
                        <span className="text-[10px] font-medium text-emerald-600">
                          {row.is_published ? "Live" : "Hidden"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Empty</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <Card className="min-w-0 max-w-full overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">{def.label}</CardTitle>
              <CardDescription>
                {def.functional
                  ? "This page has built-in functionality — the text below appears as an intro above it."
                  : def.defaultDescription}
              </CardDescription>
            </div>
            {slug && (
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View page <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
                      toast.success("Page URL copied");
                    } catch {
                      toast.error("Could not copy the URL");
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Copy <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pages…
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="page-title">Page title</Label>
                    <Input
                      id="page-title"
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder={def.label}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="page-seo">SEO description</Label>
                    <Textarea
                      id="page-seo"
                      rows={2}
                      value={draft.seo_description}
                      onChange={(e) => setDraft((d) => ({ ...d, seo_description: e.target.value }))}
                      placeholder={def.defaultDescription}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Content</Label>
                  <RichTextEditor
                    value={draft.content_html}
                    onChange={(html) => setDraft((d) => ({ ...d, content_html: html }))}
                    placeholder="Write your page content…"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={draft.is_published}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, is_published: v }))}
                    />
                    Show this page on the storefront
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => genMut.mutate()}
                      disabled={genMut.isPending}
                    >
                      {genMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate starter content
                    </Button>
                    <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                      {saveMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save page
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
