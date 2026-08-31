import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check, Copy, ExternalLink, Eye, LayoutTemplate, Loader2, Pencil, Plus, Search, Sparkles, Trash2,
} from "lucide-react";
import {
  createLandingPage,
  deleteLandingPage,
  duplicateLandingPage,
  listLandingPages,
  listLandingProducts,
  setLandingStatus,
} from "@/lib/landing-builder.functions";
import { lpImage } from "@/lib/landing-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/landing-builder/")({
  head: () => ({
    meta: [
      { title: "Landing Pages — Merchant Panel" },
      { name: "description", content: "Build standalone product landing pages with their own URL and order form." },
      { property: "og:title", content: "Landing Pages — Merchant Panel" },
      { property: "og:description", content: "Build standalone product landing pages with their own URL and order form." },
    ],
  }),
  component: () => (
    <FeatureGate feature="landing_page_create">
      <LandingPagesList />
    </FeatureGate>
  ),
});

function LandingPagesList() {
  const listFn = useServerFn(listLandingPages);
  const statusFn = useServerFn(setLandingStatus);
  const dupFn = useServerFn(duplicateLandingPage);
  const delFn = useServerFn(deleteLandingPage);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["lp-builder"], queryFn: () => listFn() });
  const pages = data?.pages ?? [];

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["lp-builder"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function pageUrl(p: any) {
    const domain = p.domains?.find((d: any) => d.status === "active" || d.status === "verified");
    if (domain) return `https://${domain.hostname}`;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/lp/${p.slug}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Landing Pages</h1>
          <p className="text-xs text-muted-foreground">
            Standalone, conversion-focused pages built from your products.
          </p>
        </div>
        <div className="ml-auto">
          <CreateDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : pages.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 font-medium">No landing pages yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a product and generate a ready-to-sell landing page.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((p: any) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex gap-3 p-3">
                {p.product?.primary_image_url ? (
                  <img
                    src={lpImage(p.product.primary_image_url)}
                    alt={p.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="truncate text-sm font-semibold">{p.title}</div>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        p.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">/lp/{p.slug}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {p.orders_count ?? 0} orders · {p.domains?.length ?? 0} domain(s)
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-1.5 border-t p-2">
                <Link to="/admin/landing-builder/$id" params={{ id: p.id }}>
                  <Button size="sm" variant="outline"><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                </Link>
                <a href={`/lp/${p.slug}?preview=true`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><Eye className="mr-1 h-3 w-3" /> Preview</Button>
                </a>
                <Button
                  size="sm"
                  variant={p.status === "published" ? "outline" : "default"}
                  onClick={() =>
                    run(
                      () => statusFn({ data: { id: p.id, status: p.status === "published" ? "draft" : "published" } }),
                      p.status === "published" ? "Unpublished" : "Published",
                    )
                  }
                >
                  {p.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Copy URL"
                  onClick={() => {
                    navigator.clipboard.writeText(pageUrl(p));
                    toast.success("URL copied");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Duplicate"
                  onClick={() => run(() => dupFn({ data: { id: p.id } }), "Duplicated")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"? This cannot be undone.`)) {
                      run(() => delFn({ data: { id: p.id } }), "Deleted");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AI_STEPS = [
  "Creating your landing page...",
  "AI is preparing your product content...",
  "Building your landing page...",
  "Finalizing...",
];

function CreateDialog() {
  const productsFn = useServerFn(listLandingProducts);
  const createFn = useServerFn(createLandingPage);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "bn" | "mixed">("en");
  const [step, setStep] = useState(-1);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["lp-builder-products"],
    queryFn: () => productsFn(),
    enabled: open,
  });

  const filtered = (products as any[]).filter((p) =>
    p.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  async function create() {
    if (!selected) return;
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 9000),
    ];
    try {
      const created = (await createFn({ data: { productId: selected, useAi: true } })) as { id: string };
      toast.success("Landing page generated");
      setOpen(false);
      navigate({ to: "/admin/landing-builder/$id", params: { id: created.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      timers.forEach(clearTimeout);
      setStep(-1);
    }
  }

  function change(next: boolean) {
    if (step >= 0) return;
    setOpen(next);
    if (!next) {
      setSelected(null);
      setQ("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Create Landing Page</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Select a product</DialogTitle></DialogHeader>

        {step >= 0 ? (
          <div className="space-y-4 py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <div className="text-sm font-medium">{AI_STEPS[Math.min(step, AI_STEPS.length - 1)]}</div>
            <div className="mx-auto flex max-w-[220px] gap-1.5">
              {AI_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This takes a few seconds. You can edit everything afterwards.
            </p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-[45vh] space-y-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading products…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No physical products found.</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent ${
                      selected === p.id ? "border-primary bg-accent" : ""
                    }`}
                  >
                    {p.primary_image_url ? (
                      <img src={lpImage(p.primary_image_url)} alt={p.name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">৳{p.price} · stock {p.stock ?? 0}</div>
                    </div>
                    {selected === p.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))
              )}
            </div>
            <Button className="w-full" disabled={!selected} onClick={create}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Create Landing Page
            </Button>
            <p className="-mt-1 text-center text-[11px] text-muted-foreground">
              AI will write the page content from this product. You can edit it before publishing.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

