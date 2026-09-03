import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check, Copy, ExternalLink, Eye, Globe, LayoutTemplate, Loader2, Pencil, Plus, Search, Sparkles, Trash2,
} from "lucide-react";
import {
  createLandingPage,
  setLandingSubdomain,
  suggestLandingSubdomains,
  deleteLandingPage,
  duplicateLandingPage,
  listLandingPages,
  listLandingProducts,
  setLandingStatus,
} from "@/lib/landing-builder.functions";
import { lpImage } from "@/lib/landing-builder";
import { OfferBuilder, OfferTypePicker } from "@/components/admin/landing/OfferBuilder";
import { defaultTiers, emptyOffer, type LandingOffer, type OfferType } from "@/lib/landing-offer";
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
    // Always prefer the page's own host: /lp/<slug> on the platform site sits
    // inside the ORZEN app scope and would open inside the ORZEN app.
    if (p.publicUrl) return p.publicUrl;
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

const WIZ_TITLES = [
  "Select the main product",
  "Choose the content language",
  "Choose an offer type",
  "Configure the offer",
];

function CreateDialog() {
  const productsFn = useServerFn(listLandingProducts);
  const createFn = useServerFn(createLandingPage);
  const suggestFn = useServerFn(suggestLandingSubdomains);
  const subFn = useServerFn(setLandingSubdomain);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "bn" | "mixed">("en");
  const [wiz, setWiz] = useState(0);
  const [offer, setOffer] = useState<LandingOffer>(emptyOffer());
  const [step, setStep] = useState(-1);
  /** Phase 2: created page waiting for its web address. */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [domainOptions, setDomainOptions] = useState<{ label: string; hostname: string }[]>([]);
  const [domainPick, setDomainPick] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["lp-builder-products"],
    queryFn: () => productsFn(),
    enabled: open,
  });

  const mainProduct = (products as any[]).find((p) => p.id === selected) ?? null;

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
      const created = (await createFn({
        data: { productId: selected, useAi: true, contentLang: lang, offer },
      })) as { id: string };
      toast.success("Landing page generated");
      setCreatedId(created.id);
      try {
        const res = (await suggestFn({ data: { id: created.id } })) as {
          options: { label: string; hostname: string }[];
        };
        setDomainOptions(res.options ?? []);
        setDomainPick(res.options?.[0]?.label ?? "");
      } catch {
        setDomainOptions([]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      timers.forEach(clearTimeout);
      setStep(-1);
    }
  }

  function openEditor(id: string) {
    setOpen(false);
    setCreatedId(null);
    setDomainOptions([]);
    setSelected(null);
    setQ("");
    navigate({ to: "/admin/landing-builder/$id", params: { id } });
  }

  async function connectDomain() {
    if (!createdId || !domainPick.trim()) return;
    setConnecting(true);
    try {
      const res = (await subFn({ data: { id: createdId, label: domainPick.trim() } })) as {
        hostname: string;
        status: string;
        error: string | null;
      };
      if (res.status === "active") toast.success(`Connected ${res.hostname}`);
      else toast.warning(res.error ?? `${res.hostname} saved — activation pending`);
      openEditor(createdId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function change(next: boolean) {
    if (step >= 0 || connecting) return;
    if (!next && createdId) {
      openEditor(createdId);
      return;
    }
    setOpen(next);
    if (!next) {
      setSelected(null);
      setQ("");
      setLang("en");
      setWiz(0);
      setOffer(emptyOffer());
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Create Landing Page</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdId ? "Choose your web address" : WIZ_TITLES[wiz]}
          </DialogTitle>
        </DialogHeader>

        {createdId ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              AI suggested these professional addresses for this page. Pick one, or type your own.
              You can change it later in Domains.
            </p>
            <div className="space-y-1.5">
              {domainOptions.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setDomainPick(o.label)}
                  className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-accent ${
                    domainPick === o.label ? "border-primary bg-accent" : ""
                  }`}
                >
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{o.hostname}</span>
                  {domainPick === o.label && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
              {domainOptions.length === 0 && (
                <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                  No suggestions available — type an address below.
                </div>
              )}
            </div>
            <Input
              value={domainPick}
              onChange={(e) => setDomainPick(e.target.value)}
              placeholder="my-product"
              disabled={connecting}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={connectDomain} disabled={connecting || !domainPick.trim()}>
                {connecting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe className="mr-1.5 h-4 w-4" />}
                Connect &amp; open editor
              </Button>
              <Button variant="outline" disabled={connecting} onClick={() => openEditor(createdId)}>
                Skip
              </Button>
            </div>
          </div>
        ) : step >= 0 ? (
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
            <div className="flex gap-1">
              {WIZ_TITLES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= wiz ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>

            {wiz === 0 && (
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
              </>
            )}

            {wiz === 1 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Language for every piece of AI-written content on this page.
                </p>
                <div className="grid gap-1.5">
                  {([
                    { v: "bn", label: "বাংলা", hint: "Full Bengali copy" },
                    { v: "en", label: "English", hint: "Full English copy" },
                    { v: "mixed", label: "বাংলা + English", hint: "Bengali with common English commerce terms" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setLang(o.v)}
                      className={`rounded-lg border p-2.5 text-left transition-colors hover:bg-accent ${
                        lang === o.v ? "border-primary bg-accent" : ""
                      }`}
                    >
                      <div className="text-sm font-medium">{o.label}</div>
                      <div className="text-[11px] text-muted-foreground">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wiz === 2 && (
              <OfferTypePicker
                value={offer.type}
                onChange={(t: OfferType) =>
                  setOffer({
                    ...offer,
                    type: t,
                    enabled: t !== "single",
                    tiers: t === "single" ? [] : defaultTiers(t),
                  })
                }
              />
            )}

            {wiz === 3 && mainProduct && (
              <div className="max-h-[55vh] overflow-y-auto pr-1">
                <OfferBuilder
                  offer={offer}
                  onChange={setOffer}
                  mainProduct={mainProduct}
                  catalog={products as any[]}
                />
              </div>
            )}

            <div className="flex gap-2">
              {wiz > 0 && (
                <Button variant="outline" onClick={() => setWiz(wiz - 1)}>
                  Back
                </Button>
              )}
              {wiz < 3 ? (
                <Button className="flex-1" disabled={!selected} onClick={() => setWiz(wiz + 1)}>
                  Continue
                </Button>
              ) : (
                <Button className="flex-1" disabled={!selected} onClick={create}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Generate Landing Page
                </Button>
              )}
            </div>
            <p className="-mt-1 text-center text-[11px] text-muted-foreground">
              AI writes the content and the design from your real product, offer and store data.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

