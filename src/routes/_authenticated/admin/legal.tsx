import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Copy, ExternalLink, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getMyLegalInfo,
  saveAndGenerateLegal,
  regenerateLegalPage,
} from "@/lib/legal.functions";

const PAGES = [
  { key: "privacy", path: "/privacy-policy", label: "Privacy Policy" },
  { key: "terms", path: "/terms", label: "Terms of Service" },
  { key: "refund", path: "/refund-policy", label: "Refund & Return Policy" },
  { key: "shipping", path: "/shipping-policy", label: "Shipping Policy" },
  { key: "contact", path: "/contact", label: "Contact Us" },
  { key: "about", path: "/about", label: "About Us" },
  { key: "data_deletion", path: "/data-deletion", label: "Data Deletion Instructions" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/legal")({
  component: LegalPageAdmin,
});

type FormState = {
  store_name: string;
  owner_name: string;
  support_email: string;
  contact_phone: string;
  business_address: string;
  website_domain: string;
  country: string;
  currency: string;
};

const EMPTY: FormState = {
  store_name: "",
  owner_name: "",
  support_email: "",
  contact_phone: "",
  business_address: "",
  website_domain: "",
  country: "Bangladesh",
  currency: "BDT",
};

function LegalPageAdmin() {
  const qc = useQueryClient();
  const fetchInfo = useServerFn(getMyLegalInfo);
  const save = useServerFn(saveAndGenerateLegal);
  const regenOne = useServerFn(regenerateLegalPage);

  const { data, isLoading } = useQuery({
    queryKey: ["myLegalInfo"],
    queryFn: () => fetchInfo(),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  useEffect(() => {
    if (data?.info) {
      const i: any = data.info;
      setForm({
        store_name: i.store_name || "",
        owner_name: i.owner_name || "",
        support_email: i.support_email || "",
        contact_phone: i.contact_phone || "",
        business_address: i.business_address || "",
        website_domain: i.website_domain || "",
        country: i.country || "Bangladesh",
        currency: i.currency || "BDT",
      });
    }
  }, [data?.info]);

  const pages = (data?.info as any)?.pages || {};
  const generatedAt = (data?.info as any)?.generated_at || null;

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("Pages generated successfully");
      qc.invalidateQueries({ queryKey: ["myLegalInfo"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to generate"),
  });

  const regenMut = useMutation({
    mutationFn: (key: string) => regenOne({ data: { key } }),
    onSuccess: () => {
      toast.success("Page regenerated");
      qc.invalidateQueries({ queryKey: ["myLegalInfo"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to regenerate"),
  });

  const baseUrl = form.website_domain
    ? `https://${form.website_domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : (typeof window !== "undefined" ? window.location.origin : "");

  const canGenerate =
    form.store_name && form.owner_name && form.support_email && form.contact_phone &&
    form.business_address && form.website_domain && form.country && form.currency;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Legal & Business Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate Meta-ready legal and info pages (Privacy, Terms, Refund, Shipping, Contact, About, Data Deletion) in one click.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Information</CardTitle>
          <CardDescription>These details are used to generate every legal page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Store Name" id="store_name">
            <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} placeholder="My Store" />
          </Field>
          <Field label="Business Owner Name" id="owner_name">
            <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Support Email" id="support_email">
            <Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} placeholder="support@store.com" />
          </Field>
          <Field label="Contact Phone" id="contact_phone">
            <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+8801XXXXXXXXX" />
          </Field>
          <Field label="Website Domain" id="website_domain">
            <Input value={form.website_domain} onChange={(e) => setForm({ ...form, website_domain: e.target.value })} placeholder="mystore.orzen.top" />
          </Field>
          <Field label="Country" id="country">
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Currency" id="currency">
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="BDT" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Business Address" id="business_address">
              <Textarea
                value={form.business_address}
                onChange={(e) => setForm({ ...form, business_address: e.target.value })}
                rows={2}
                placeholder="Street, City, Postal code"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => saveMut.mutate()}
          disabled={!canGenerate || saveMut.isPending || isLoading}
          className="gap-2"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatedAt ? "Save & Regenerate All" : "Generate All Pages"}
        </Button>
        {generatedAt && (
          <span className="text-xs text-muted-foreground">
            Last generated: {new Date(generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated URLs</CardTitle>
          <CardDescription>Each page is served on your store's own domain.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PAGES.map((p) => {
            const generated = !!pages[p.key];
            const url = `${baseUrl}${p.path}`;
            return (
              <div
                key={p.key}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.label}</span>
                    {generated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Generated
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">Not generated</span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground" title={url}>
                    {url}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(url).then(
                        () => toast.success("URL copied"),
                        () => toast.error("Copy failed"),
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={!generated}
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Page
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={!generatedAt || regenMut.isPending}
                    onClick={() => regenMut.mutate(p.key)}
                  >
                    <RefreshCw className={"h-3.5 w-3.5 " + (regenMut.isPending && regenMut.variables === p.key ? "animate-spin" : "")} /> Regenerate
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Pages include Meta Title, Description, Open Graph tags and a canonical URL — ready for Facebook App Review, Messenger Platform, Instagram API, Meta Business Verification and Google indexing.
      </p>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
