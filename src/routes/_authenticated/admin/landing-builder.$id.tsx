import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  addLandingCustomDomain,
  getLandingPage,
  removeLandingDomain,
  resyncLandingPage,
  setLandingStatus,
  setLandingSubdomain,
  updateLandingPage,
  verifyLandingDomain,
} from "@/lib/landing-builder.functions";
import {
  FEATURE_ICONS,
  FORM_FIELDS,
  PAYMENT_METHODS,
  slugify,
  type LandingContent,
  type LandingFormConfig,
  type LandingTheme,
} from "@/lib/landing-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/landing-builder/$id")({
  head: () => ({
    meta: [
      { title: "Edit landing page — Store Admin" },
      { name: "description", content: "Edit landing page content, order form, theme and domains." },
      { property: "og:title", content: "Edit landing page — Store Admin" },
      { property: "og:description", content: "Edit landing page content, order form, theme and domains." },
    ],
  }),
  component: () => (
    <FeatureGate feature="landing_pages">
      <LandingEditor />
    </FeatureGate>
  ),
});

function LandingEditor() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getLandingPage);
  const saveFn = useServerFn(updateLandingPage);
  const statusFn = useServerFn(setLandingStatus);
  const resyncFn = useServerFn(resyncLandingPage);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["lp-builder", id], queryFn: () => getFn({ data: { id } }) });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState<LandingContent | null>(null);
  const [theme, setTheme] = useState<LandingTheme | null>(null);
  const [form, setForm] = useState<LandingFormConfig | null>(null);
  const [seo, setSeo] = useState<{ title?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.page as any;
    setTitle(p.title);
    setSlug(p.slug);
    setContent(p.content as LandingContent);
    setTheme(p.theme as LandingTheme);
    setForm(p.form_config as LandingFormConfig);
    setSeo((p.seo ?? {}) as { title?: string; description?: string });
  }, [data]);

  if (isLoading || !data || !content || !theme || !form) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const page = data.page as any;

  function patch<K extends keyof LandingContent>(key: K, value: Partial<LandingContent[K]>) {
    setContent((c) => (c ? { ...c, [key]: { ...(c[key] as object), ...value } } : c));
  }

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: { id, title, slug, content: content as any, theme: theme as any, form_config: form as any, seo: seo as any } });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["lp-builder"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["lp-builder", id] });
      qc.invalidateQueries({ queryKey: ["lp-builder"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/landing-builder">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{page.title}</h1>
          <div className="text-xs text-muted-foreground">/lp/{page.slug} · {page.status}</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" /> Preview</Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Re-generate content from the current product? Your edits to content will be replaced.")) {
                run(() => resyncFn({ data: { id } }), "Re-synced from product");
              }
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Re-sync
          </Button>
          <Button
            variant={page.status === "published" ? "outline" : "default"}
            size="sm"
            onClick={() =>
              run(
                () => statusFn({ data: { id, status: page.status === "published" ? "draft" : "published" } }),
                page.status === "published" ? "Unpublished" : "Published",
              )
            }
          >
            {page.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} Save
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="form">Order form</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* -------- Content -------- */}
        <TabsContent value="content" className="space-y-4 pt-4">
          <Card title="Hero" enabled={content.hero.enabled} onToggle={(v) => patch("hero", { enabled: v })}>
            <Field label="Badge" value={content.hero.badge} onChange={(v) => patch("hero", { badge: v })} />
            <Field label="Headline" value={content.hero.headline} onChange={(v) => patch("hero", { headline: v })} />
            <Area label="Subheadline" value={content.hero.subheadline} onChange={(v) => patch("hero", { subheadline: v })} />
            <Field label="Hero image URL" value={content.hero.image} onChange={(v) => patch("hero", { image: v })} />
            <Field label="Button text" value={content.hero.ctaText} onChange={(v) => patch("hero", { ctaText: v })} />
          </Card>

          <Card title="Pricing">
            <div className="grid gap-3 sm:grid-cols-3">
              <Num label="Price" value={content.pricing.price} onChange={(v) => patch("pricing", { price: v })} />
              <Num label="Old price" value={content.pricing.oldPrice ?? 0} onChange={(v) => patch("pricing", { oldPrice: v || null })} />
              <Field label="Note" value={content.pricing.note} onChange={(v) => patch("pricing", { note: v })} />
            </div>
          </Card>

          <Card title="Gallery" enabled={content.gallery.enabled} onToggle={(v) => patch("gallery", { enabled: v })}>
            <Field label="Section title" value={content.gallery.title} onChange={(v) => patch("gallery", { title: v })} />
            <Area
              label="Image URLs (one per line)"
              value={content.gallery.images.join("\n")}
              onChange={(v) => patch("gallery", { images: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </Card>

          <Card title="Features" enabled={content.features.enabled} onToggle={(v) => patch("features", { enabled: v })}>
            <Field label="Section title" value={content.features.title} onChange={(v) => patch("features", { title: v })} />
            <List
              items={content.features.items}
              onChange={(items) => patch("features", { items })}
              blank={{ icon: "check", title: "", text: "" }}
              render={(item, update) => (
                <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr]">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={item.icon}
                    onChange={(e) => update({ ...item, icon: e.target.value })}
                  >
                    {FEATURE_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <Input placeholder="Title" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
                  <Input placeholder="Text" value={item.text} onChange={(e) => update({ ...item, text: e.target.value })} />
                </div>
              )}
            />
          </Card>

          <Card title="Benefits" enabled={content.benefits.enabled} onToggle={(v) => patch("benefits", { enabled: v })}>
            <Field label="Section title" value={content.benefits.title} onChange={(v) => patch("benefits", { title: v })} />
            <List
              items={content.benefits.items}
              onChange={(items) => patch("benefits", { items })}
              blank={{ title: "", text: "" }}
              render={(item, update) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Title" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
                  <Input placeholder="Text" value={item.text} onChange={(e) => update({ ...item, text: e.target.value })} />
                </div>
              )}
            />
          </Card>

          <Card title="Details" enabled={content.details.enabled} onToggle={(v) => patch("details", { enabled: v })}>
            <Field label="Section title" value={content.details.title} onChange={(v) => patch("details", { title: v })} />
            <Area label="Text" value={content.details.text} onChange={(v) => patch("details", { text: v })} rows={6} />
            <List
              items={content.details.specs}
              onChange={(specs) => patch("details", { specs })}
              blank={{ label: "", value: "" }}
              render={(item, update) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Label" value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} />
                  <Input placeholder="Value" value={item.value} onChange={(e) => update({ ...item, value: e.target.value })} />
                </div>
              )}
            />
          </Card>

          <Card title="Reviews" enabled={content.reviews.enabled} onToggle={(v) => patch("reviews", { enabled: v })}>
            <Field label="Section title" value={content.reviews.title} onChange={(v) => patch("reviews", { title: v })} />
            <List
              items={content.reviews.items}
              onChange={(items) => patch("reviews", { items })}
              blank={{ name: "", rating: 5, text: "" }}
              render={(item, update) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_2fr]">
                  <Input placeholder="Name" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
                  <Input
                    type="number" min={1} max={5} value={item.rating}
                    onChange={(e) => update({ ...item, rating: Number(e.target.value) })}
                  />
                  <Input placeholder="Review" value={item.text} onChange={(e) => update({ ...item, text: e.target.value })} />
                </div>
              )}
            />
          </Card>

          <Card title="FAQ" enabled={content.faq.enabled} onToggle={(v) => patch("faq", { enabled: v })}>
            <Field label="Section title" value={content.faq.title} onChange={(v) => patch("faq", { title: v })} />
            <List
              items={content.faq.items}
              onChange={(items) => patch("faq", { items })}
              blank={{ q: "", a: "" }}
              render={(item, update) => (
                <div className="grid gap-2">
                  <Input placeholder="Question" value={item.q} onChange={(e) => update({ ...item, q: e.target.value })} />
                  <Input placeholder="Answer" value={item.a} onChange={(e) => update({ ...item, a: e.target.value })} />
                </div>
              )}
            />
          </Card>

          <Card title="Contact" enabled={content.contact.enabled} onToggle={(v) => patch("contact", { enabled: v })}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" value={content.contact.phone} onChange={(v) => patch("contact", { phone: v })} />
              <Field label="Email" value={content.contact.email} onChange={(v) => patch("contact", { email: v })} />
              <Field label="Address" value={content.contact.address} onChange={(v) => patch("contact", { address: v })} />
              <Field label="Hours" value={content.contact.hours} onChange={(v) => patch("contact", { hours: v })} />
            </div>
          </Card>

          <Card title="Call to action" enabled={content.cta.enabled} onToggle={(v) => patch("cta", { enabled: v })}>
            <Field label="Headline" value={content.cta.headline} onChange={(v) => patch("cta", { headline: v })} />
            <Field label="Text" value={content.cta.text} onChange={(v) => patch("cta", { text: v })} />
            <Field label="Button text" value={content.cta.buttonText} onChange={(v) => patch("cta", { buttonText: v })} />
          </Card>

          <Card title="Footer" enabled={content.footer.enabled} onToggle={(v) => patch("footer", { enabled: v })}>
            <Field label="Footer text" value={content.footer.text} onChange={(v) => patch("footer", { text: v })} />
          </Card>
        </TabsContent>

        {/* -------- Order form -------- */}
        <TabsContent value="form" className="space-y-4 pt-4">
          <Card title="Order section" enabled={content.order.enabled} onToggle={(v) => patch("order", { enabled: v })}>
            <Field label="Title" value={content.order.title} onChange={(v) => patch("order", { title: v })} />
            <Field label="Note" value={content.order.note} onChange={(v) => patch("order", { note: v })} />
            <Area label="Success message" value={content.order.successMessage} onChange={(v) => patch("order", { successMessage: v })} />
          </Card>

          <Card title="Fields">
            <div className="space-y-2">
              {form.fields.map((f, i) => (
                <div key={f.key} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                  <div className="w-32 text-xs font-medium">
                    {FORM_FIELDS.find((x) => x.key === f.key)?.label ?? f.key}
                  </div>
                  <Input
                    className="h-8 max-w-56"
                    value={f.label}
                    onChange={(e) => {
                      const next = [...form.fields];
                      next[i] = { ...f, label: e.target.value };
                      setForm({ ...form, fields: next });
                    }}
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(v) => {
                        const next = [...form.fields];
                        next[i] = { ...f, enabled: v };
                        setForm({ ...form, fields: next });
                      }}
                    />
                    Show
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={f.required}
                      onCheckedChange={(v) => {
                        const next = [...form.fields];
                        next[i] = { ...f, required: v };
                        setForm({ ...form, fields: next });
                      }}
                    />
                    Required
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Payment & delivery">
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const on = form.paymentMethods.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        paymentMethods: on
                          ? (form.paymentMethods.filter((x) => x !== m).length ? form.paymentMethods.filter((x) => x !== m) : ["cod"])
                          : [...form.paymentMethods, m],
                      })
                    }
                    className={`rounded-md border px-3 py-1.5 text-xs uppercase ${on ? "border-primary bg-primary/10 text-primary" : ""}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Delivery charge</Label>
                <Input
                  type="number"
                  value={form.deliveryCharge}
                  onChange={(e) => setForm({ ...form, deliveryCharge: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Submit button text</Label>
                <Input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* -------- Design -------- */}
        <TabsContent value="design" className="space-y-4 pt-4">
          <Card title="Theme">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Primary color</Label>
                <Input type="color" value={theme.primary} onChange={(e) => setTheme({ ...theme, primary: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Accent color</Label>
                <Input type="color" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={theme.dark} onCheckedChange={(v) => setTheme({ ...theme, dark: v })} /> Dark background
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={theme.rounded} onCheckedChange={(v) => setTheme({ ...theme, rounded: v })} /> Rounded corners
              </label>
            </div>
          </Card>
        </TabsContent>

        {/* -------- Domains -------- */}
        <TabsContent value="domains" className="space-y-4 pt-4">
          <DomainsPanel
            pageId={id}
            rootDomain={data.rootDomain}
            dnsTarget={data.dnsTarget}
            apexIp={data.apexIp}
            domains={data.domains as any[]}
            onChanged={() => qc.invalidateQueries({ queryKey: ["lp-builder", id] })}
          />
        </TabsContent>

        {/* -------- Settings -------- */}
        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card title="Page">
            <Field label="Internal title" value={title} onChange={setTitle} />
            <div>
              <Label className="text-xs">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">/lp/</span>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>
            </div>
            {data.product && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Source product: <span className="font-medium text-foreground">{data.product.name}</span> · ৳
                {data.product.price} · stock {data.product.stock ?? 0}
              </div>
            )}
          </Card>

          <Card title="SEO">
            <Field label="Meta title" value={seo.title ?? ""} onChange={(v) => setSeo({ ...seo, title: v })} />
            <Area label="Meta description" value={seo.description ?? ""} onChange={(v) => setSeo({ ...seo, description: v })} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Domains ---------- */

function DomainsPanel({
  pageId, rootDomain, dnsTarget, apexIp, domains, onChanged,
}: {
  pageId: string;
  rootDomain: string;
  dnsTarget: string;
  apexIp: string;
  domains: any[];
  onChanged: () => void;
}) {
  const subFn = useServerFn(setLandingSubdomain);
  const addFn = useServerFn(addLandingCustomDomain);
  const verifyFn = useServerFn(verifyLandingDomain);
  const delFn = useServerFn(removeLandingDomain);

  const sub = domains.find((d) => d.kind === "subdomain");
  const [label, setLabel] = useState(sub ? String(sub.hostname).split(".")[0]! : "");
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card title="Subdomain">
        <p className="text-xs text-muted-foreground">
          Serve this landing page on its own subdomain of {rootDomain}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-56" value={label} onChange={(e) => setLabel(slugify(e.target.value))} placeholder="my-offer" />
          <span className="text-sm text-muted-foreground">.{rootDomain}</span>
          <Button size="sm" disabled={busy || label.length < 3} onClick={() => run(() => subFn({ data: { id: pageId, label } }), "Subdomain saved")}>
            Save
          </Button>
        </div>
        {sub && (
          <div className="flex items-center gap-2 text-xs">
            <a className="font-medium underline" href={`https://${sub.hostname}`} target="_blank" rel="noreferrer">
              {sub.hostname}
            </a>
            <Button size="sm" variant="ghost" onClick={() => run(() => delFn({ data: { domainId: sub.id } }), "Removed")}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        )}
      </Card>

      <Card title="Custom domain">
        <p className="text-xs text-muted-foreground">
          Point your own domain at this landing page. Add a CNAME to <code>{dnsTarget}</code> (or an A record to{" "}
          <code>{apexIp}</code> for a root domain), plus the TXT record shown after adding.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-72" value={host} placeholder="offer.mybrand.com" onChange={(e) => setHost(e.target.value)} />
          <Button
            size="sm"
            disabled={busy || host.length < 4}
            onClick={() => run(async () => { await addFn({ data: { id: pageId, hostname: host } }); setHost(""); }, "Domain added")}
          >
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>

        <div className="space-y-2">
          {domains.filter((d) => d.kind === "custom").map((d) => (
            <div key={d.id} className="rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.hostname}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 uppercase">{d.status}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
                    const r = (await verifyFn({ data: { domainId: d.id } })) as { ok: boolean; reason: string };
                    if (!r.ok) throw new Error(r.reason);
                  }, "Domain verified")}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Check
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => run(() => delFn({ data: { domainId: d.id } }), "Removed")}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div>CNAME <code>{d.hostname}</code> → <code>{d.dns_target ?? dnsTarget}</code></div>
                <div>TXT <code>_orzen-verify.{d.hostname}</code> → <code>{d.verification_token}</code></div>
                {d.last_error && <div className="text-red-500">{d.last_error}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ---------- small building blocks ---------- */

function Card({
  title, enabled, onToggle, children,
}: {
  title: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        {onToggle && <Switch checked={Boolean(enabled)} onCheckedChange={onToggle} />}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function List<T>({
  items, onChange, blank, render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {render(item, (next) => {
              const copy = [...items];
              copy[i] = next;
              onChange(copy);
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, x) => x !== i))}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...items, { ...(blank as object) } as T])}>
        <Plus className="mr-1 h-3 w-3" /> Add
      </Button>
    </div>
  );
}
