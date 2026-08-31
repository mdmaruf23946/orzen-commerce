import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, Loader2, Monitor, Plus, RefreshCw, Save, Smartphone, Sparkles, Trash2,
} from "lucide-react";
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
  FORM_FIELDS,
  PAYMENT_METHODS,
  normalizeContent,
  normalizeDeliveryZones,
  slugify,
  type LandingContent,
  type LandingDeliveryZone,
  type LandingFormConfig,
  type LandingTheme,
} from "@/lib/landing-builder";
import {
  DescriptionEditor,
  FaqEditor,
  FooterEditor,
  HeaderEditor,
  HeroEditor,
  OrderTextEditor,
  ProductEditor,
  ReviewsEditor,
  SectionList,
  type SectionKey,
} from "@/components/admin/landing/section-editors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/landing-builder/$id")({
  head: () => ({
    meta: [
      { title: "Edit landing page — Merchant Panel" },
      { name: "description", content: "Edit landing page content section by section, order form, domains and settings." },
      { property: "og:title", content: "Edit landing page — Merchant Panel" },
      { property: "og:description", content: "Edit landing page content section by section, order form, domains and settings." },
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

  const [tab, setTab] = useState("content");
  const [section, setSection] = useState<SectionKey | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState<LandingContent | null>(null);
  const [theme, setTheme] = useState<LandingTheme | null>(null);
  const [form, setForm] = useState<LandingFormConfig | null>(null);
  const [seo, setSeo] = useState<{ title?: string; description?: string; image?: string }>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (!data) return;
    const p = data.page as any;
    setTitle(p.title);
    setSlug(p.slug);
    setContent(normalizeContent(p.content));
    setTheme(p.theme as LandingTheme);
    setForm(p.form_config as LandingFormConfig);
    setSeo((p.seo ?? {}) as { title?: string; description?: string; image?: string });
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
      setPreviewKey((k) => k + 1);
      qc.invalidateQueries({ queryKey: ["lp-builder"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveSection() {
    await save();
    setSection(null);
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

  const storeInfo = (data as any).store ?? null;
  const productImages = (() => {
    const p = (data as any).product;
    if (!p) return content.product.images ?? [];
    const gal = Array.isArray(p.gallery)
      ? p.gallery
          .map((g: any) => (typeof g === "string" ? g : String(g?.url ?? "")))
          .filter(Boolean)
      : [];
    const all = [p.primary_image_url, ...gal, ...(content.product.images ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(all)).slice(0, 12);
  })();

  const editorProps = {
    content,
    patch,
    onBack: () => setSection(null),
    onSave: saveSection,
    saving,
    store: storeInfo,
    productImages,
  };

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
          <Button variant="outline" size="sm" onClick={() => { setShowPreview((v) => !v); setPreviewKey((k) => k + 1); }}>
            <Eye className="mr-1 h-3 w-3" /> {showPreview ? "Hide preview" : "Preview"}
          </Button>
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

      {showPreview && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Live preview</span>
            <span className="text-xs text-muted-foreground">View only · reflects saved content</span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}>
                <Monitor className="mr-1 h-3.5 w-3.5" /> Desktop
              </Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}>
                <Smartphone className="mr-1 h-3.5 w-3.5" /> Mobile
              </Button>
              <a href={`/lp/${page.slug}?preview=true`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">Open</Button>
              </a>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-muted/40 p-2">
            <iframe
              key={previewKey}
              title="Landing page preview"
              src={`/lp/${page.slug}?preview=true`}
              className="mx-auto block h-[70vh] border-0 bg-white"
              style={{ width: device === "mobile" ? 390 : "100%", pointerEvents: "none" }}
            />
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSection(null); }}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="form">Order form</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* -------- Content: section based -------- */}
        <TabsContent value="content" className="space-y-4 pt-4">
          {section === null && <SectionList content={content} onOpen={setSection} />}
          {section === "header" && <HeaderEditor {...editorProps} />}
          {section === "hero" && <HeroEditor {...editorProps} />}
          {section === "product" && <ProductEditor {...editorProps} />}
          {section === "description" && <DescriptionEditor {...editorProps} />}
          {section === "faq" && <FaqEditor {...editorProps} />}
          {section === "reviews" && <ReviewsEditor {...editorProps} />}
          {section === "order" && (
            <OrderTextEditor
              {...editorProps}
              buttonText={form.buttonText}
              onButtonText={(v) => setForm({ ...form, buttonText: v })}
              onOpenFormTab={() => { setSection(null); setTab("form"); }}
            />
          )}
          {section === "footer" && <FooterEditor {...editorProps} />}
        </TabsContent>

        {/* -------- Order form -------- */}
        <TabsContent value="form" className="space-y-4 pt-4">
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

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </TabsContent>

        {/* -------- Design (system controlled) -------- */}
        <TabsContent value="design" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Professional Landing Page</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your landing page uses the platform's professional design system.
                  Design customization is managed automatically — you only edit the content.
                </p>
              </div>
            </div>
          </div>
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
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="text-xs">
                Status: <span className="font-semibold uppercase">{page.status}</span>
              </div>
              <Button
                size="sm"
                variant={page.status === "published" ? "outline" : "default"}
                className="ml-auto"
                onClick={() =>
                  run(
                    () => statusFn({ data: { id, status: page.status === "published" ? "draft" : "published" } }),
                    page.status === "published" ? "Unpublished" : "Published",
                  )
                }
              >
                {page.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            </div>
            {data.product && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Source product: <span className="font-medium text-foreground">{data.product.name}</span> · ৳
                {data.product.price} · stock {data.product.stock ?? 0}
              </div>
            )}
          </Card>

          <Card title="Delivery zones">
            <p className="text-xs text-muted-foreground">
              Add areas with their own delivery charge. Customers pick their area on the
              landing page and the charge is applied automatically. No zones = the flat
              delivery charge from the Order Form tab is used.
            </p>
            <div>
              <Label className="text-xs">Selector label</Label>
              <Input
                value={form.deliveryZoneLabel ?? ""}
                placeholder="ডেলিভারি এলাকা"
                onChange={(e) => setForm({ ...form, deliveryZoneLabel: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              {(form.deliveryZones ?? []).map((z, i) => (
                <div key={z.id || i} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2">
                  <Input
                    value={z.name}
                    placeholder="Zone name"
                    onChange={(e) => setZone(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    value={z.charge}
                    onChange={(e) => setZone(i, { charge: Number(e.target.value) })}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Default zone"
                      onClick={() =>
                        setForm({
                          ...form,
                          deliveryZones: (form.deliveryZones ?? []).map((x, xi) => ({
                            ...x,
                            isDefault: xi === i,
                          })),
                        })
                      }
                      className={`rounded-md border px-2 py-1.5 text-[11px] ${
                        z.isDefault ? "border-primary bg-primary/10 text-primary" : ""
                      }`}
                    >
                      Default
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          ...form,
                          deliveryZones: normalizeDeliveryZones(
                            (form.deliveryZones ?? []).filter((_, xi) => xi !== i),
                          ),
                        })
                      }
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
              {!(form.deliveryZones ?? []).length && (
                <p className="text-xs text-muted-foreground">No zones yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={addZone}>
                Add zone
              </Button>
              {!!(data as any).storeZones?.length && (
                <Button size="sm" variant="outline" onClick={importStoreZones}>
                  Import store zones
                </Button>
              )}
            </div>
          </Card>

          <Card title="SEO">
            <Field label="Meta title" value={seo.title ?? ""} onChange={(v) => setSeo({ ...seo, title: v })} />
            <Area label="Meta description" value={seo.description ?? ""} onChange={(v) => setSeo({ ...seo, description: v })} />
            <Field label="Social share image URL" value={seo.image ?? ""} onChange={(v) => setSeo({ ...seo, image: v })} />
          </Card>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save changes"}
          </Button>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
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
