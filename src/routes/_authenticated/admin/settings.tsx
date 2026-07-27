import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
  Share2,
  Building2,
  Users,
  Globe,
  AlertTriangle,
  Hash,
  Palette,
} from "lucide-react";
import { StoreBrandMark } from "@/components/admin/StoreBrandMark";
import {
  getMyStore,
  updateMyStore,
  resetStoreToTemplate,
  adminGetRequireCustomerLogin,
  adminSetRequireCustomerLogin,
} from "@/lib/admin.functions";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  computeInvoicePreview,
} from "@/lib/invoice-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { AdSlot } from "@/components/admin/AdSlot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "PKR", "AED", "SAR"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা" },
  { value: "hi", label: "हिन्दी" },
  { value: "ar", label: "العربية" },
];
const TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsPage() {
  const fetchStore = useServerFn(getMyStore);
  const save = useServerFn(updateMyStore);
  const resetFn = useServerFn(resetStoreToTemplate);
  const getReqLogin = useServerFn(adminGetRequireCustomerLogin);
  const setReqLogin = useServerFn(adminSetRequireCustomerLogin);
  const qc = useQueryClient();

  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const { data: reqLogin } = useQuery({
    queryKey: ["admin", "require-customer-login"],
    queryFn: () => getReqLogin(),
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingLogin, setSavingLogin] = useState(false);

  useEffect(() => {
    if (store && !form) setForm({ ...store });
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!store || !form) return false;
    return JSON.stringify(store) !== JSON.stringify(form);
  }, [store, form]);

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  function set<K extends string>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error("Store name is required");
    if (!form.slug?.trim()) return toast.error("Store slug is required");
    setSaving(true);
    try {
      await save({
        data: {
          name: form.name,
          slug: form.slug,
          description: form.description,
          logo_url: form.logo_url,
          phone: form.phone,
          whatsapp: form.whatsapp,
          email: form.email || null,
          facebook: form.facebook,
          instagram: form.instagram,
          youtube: form.youtube,
          tiktok: form.tiktok,
          linkedin: form.linkedin,
          website: form.website,
          address: form.address,
          primary_color: form.primary_color || "#0f172a",
          business_name: form.business_name,
          owner_name: form.owner_name,
          trade_license: form.trade_license,
          tax_number: form.tax_number,
          currency: form.currency || "BDT",
          language: form.language || "en",
          timezone: form.timezone || "Asia/Dhaka",
          allow_guest_checkout: !!form.allow_guest_checkout,
          branding: form.branding ?? { source: "platform" },
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "store"] });
      const next = await qc.fetchQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
      if (next) setForm({ ...(next as any) });
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRequireLogin(enabled: boolean) {
    setSavingLogin(true);
    try {
      await setReqLogin({ data: { enabled } });
      await qc.invalidateQueries({ queryKey: ["admin", "require-customer-login"] });
      toast.success(enabled ? "Login now required at checkout" : "Login no longer required");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingLogin(false);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      await resetFn();
      await qc.invalidateQueries();
      toast.success("Store reset to the latest default template.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Store Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          General information customers see and how your store behaves.
        </p>
      </div>

      <div className="space-y-5">
        {/* 1. Store Identity */}
        <Section icon={StoreIcon} title="Store Identity" description="Logo, name, and brand color.">
          <Field label="Store logo">
            <ImageUploader storeId={form.id} value={form.logo_url} onChange={(v) => set("logo_url", v)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name *" htmlFor="s-name">
              <Input id="s-name" required maxLength={120} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Store slug *" htmlFor="s-slug" hint="Lowercase letters, numbers, hyphens.">
              <Input
                id="s-slug"
                required
                maxLength={60}
                value={form.slug ?? ""}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="s-desc">
            <Textarea id="s-desc" rows={3} maxLength={1000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Primary brand color" htmlFor="s-color">
            <div className="flex items-center gap-2">
              <input
                id="s-color"
                type="color"
                value={form.primary_color || "#0f172a"}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-10 w-14 shrink-0 rounded-md border"
              />
              <Input
                value={form.primary_color || ""}
                onChange={(e) => set("primary_color", e.target.value)}
                placeholder="#0f172a"
                className="font-mono"
              />
            </div>
          </Field>
        </Section>

        {/* 2. Contact Information */}
        <Section icon={PhoneIcon} title="Contact Information" description="How customers can reach you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number" htmlFor="c-phone">
              <Input id="c-phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="WhatsApp number" htmlFor="c-wa">
              <Input id="c-wa" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="Email address" htmlFor="c-email">
              <Input id="c-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
          <Field label="Store address" htmlFor="c-addr">
            <Textarea id="c-addr" rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </Section>

        {/* 3. Social Links */}
        <Section
          icon={Share2}
          title="Social Links"
          description="Empty links are automatically hidden on your storefront."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["facebook", "Facebook", "https://facebook.com/yourpage"],
              ["instagram", "Instagram", "https://instagram.com/yourhandle"],
              ["youtube", "YouTube", "https://youtube.com/@channel"],
              ["tiktok", "TikTok", "https://tiktok.com/@handle"],
              ["linkedin", "LinkedIn", "https://linkedin.com/company/..."],
              ["website", "Website (optional)", "https://yourdomain.com"],
            ].map(([k, label, ph]) => (
              <Field key={k} label={label} htmlFor={`soc-${k}`}>
                <Input
                  id={`soc-${k}`}
                  value={form[k] ?? ""}
                  placeholder={ph}
                  onChange={(e) => set(k, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </Section>

        {/* 4. Business Information */}
        <Section icon={Building2} title="Business Information" description="Used on invoices and legal pages.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="b-name">
              <Input id="b-name" value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
            </Field>
            <Field label="Owner name" htmlFor="b-owner">
              <Input id="b-owner" value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} />
            </Field>
            <Field label="Trade license (optional)" htmlFor="b-tl">
              <Input id="b-tl" value={form.trade_license ?? ""} onChange={(e) => set("trade_license", e.target.value)} />
            </Field>
            <Field label="Tax / VAT number (optional)" htmlFor="b-tax">
              <Input id="b-tax" value={form.tax_number ?? ""} onChange={(e) => set("tax_number", e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* 5. Customer Login Settings */}
        <Section icon={Users} title="Customer Login Settings" description="Control how shoppers check out.">
          <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Allow guest checkout</div>
              <div className="text-xs text-muted-foreground">Shoppers can order without creating an account.</div>
            </div>
            <Switch
              checked={!!form.allow_guest_checkout}
              onCheckedChange={(v) => set("allow_guest_checkout", v)}
            />
          </label>
          <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Require login before checkout</div>
              <div className="text-xs text-muted-foreground">
                When enabled, shoppers must sign in or create a customer account before placing an order.
              </div>
            </div>
            <Switch
              checked={!!reqLogin?.enabled}
              disabled={savingLogin}
              onCheckedChange={toggleRequireLogin}
            />
          </label>
        </Section>

        {/* 6. Localization */}
        <Section icon={Globe} title="Localization" description="Currency, language, and timezone.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency" htmlFor="loc-cur">
              <select
                id="loc-cur"
                value={form.currency || "BDT"}
                onChange={(e) => set("currency", e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Language" htmlFor="loc-lang">
              <select
                id="loc-lang"
                value={form.language || "en"}
                onChange={(e) => set("language", e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Time zone" htmlFor="loc-tz">
              <select
                id="loc-tz"
                value={form.timezone || "Asia/Dhaka"}
                onChange={(e) => set("timezone", e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* 6b. Invoice Numbering */}
        <InvoiceNumberingSection />

        {/* 7. Danger Zone */}
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 sm:p-6">
          <div className="mb-3 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Replace your current design, banners, categories and products with the latest default template. This cannot be undone.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" disabled={resetting}>
                {resetting ? "Resetting…" : "Reset to Default Template"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to default template?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your current banners, categories and products will be deleted and replaced with the platform's
                  latest default template. Your store settings (design, theme, defaults) will also be overwritten.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={reset}>Yes, reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>

        <AdSlot slotKey="admin_settings_bottom" />
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button type="submit" disabled={saving || !dirty} className="ml-auto min-w-32">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function InvoiceNumberingSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(getInvoiceSettings);
  const saveFn = useServerFn(updateInvoiceSettings);


  const { data } = useQuery({
    queryKey: ["admin", "invoice-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data)
      setForm({
        prefix: data.prefix,
        separator: data.separator,
        padding: data.padding,
        start_number: data.start_number,
        include_year: data.include_year,
        include_month: data.include_month,
      });
  }, [data]);

  if (!form || !data) {
    return (
      <Section icon={Hash} title="Invoice Numbering" description="How invoice numbers are generated.">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </Section>
    );
  }

  const nextSeq = Math.max(Number(data.next_number ?? 1), Number(form.start_number || 1));
  const preview = (() => {
    try {
      return computeInvoicePreview(form, nextSeq);
    } catch {
      return "";
    }
  })();

  function set<K extends string>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function onSave(e: React.MouseEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveFn({
        data: {
          prefix: String(form.prefix || "").toUpperCase(),
          separator: form.separator,
          padding: Number(form.padding),
          start_number: Number(form.start_number),
          include_year: !!form.include_year,
          include_month: !!form.include_month,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "invoice-settings"] });
      toast.success("Invoice settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section icon={Hash} title="Invoice Numbering" description="Prefix, separator, padding and starting number for invoices.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prefix" htmlFor="inv-prefix" hint="Letters and digits only, e.g. INV or ST.">
          <Input
            id="inv-prefix"
            maxLength={10}
            value={form.prefix ?? ""}
            onChange={(e) => set("prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </Field>
        <Field label="Separator" htmlFor="inv-sep">
          <select
            id="inv-sep"
            value={form.separator}
            onChange={(e) => set("separator", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="-">Dash ( - )</option>
            <option value="/">Slash ( / )</option>
            <option value="_">Underscore ( _ )</option>
            <option value="">None</option>
          </select>
        </Field>
        <Field label="Number padding" htmlFor="inv-pad" hint="Zero-pad the sequence to this many digits (4–8).">
          <Input
            id="inv-pad"
            type="number"
            min={4}
            max={8}
            value={form.padding}
            onChange={(e) => set("padding", Number(e.target.value))}
          />
        </Field>
        <Field label="Starting number" htmlFor="inv-start" hint="Sequence starts here for new invoices.">
          <Input
            id="inv-start"
            type="number"
            min={1}
            value={form.start_number}
            onChange={(e) => set("start_number", Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Include year</div>
            <div className="text-xs text-muted-foreground">Adds YYYY to the invoice number.</div>
          </div>
          <Switch checked={!!form.include_year} onCheckedChange={(v) => set("include_year", v)} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Include month</div>
            <div className="text-xs text-muted-foreground">Adds MM to the invoice number.</div>
          </div>
          <Switch checked={!!form.include_month} onCheckedChange={(v) => set("include_month", v)} />
        </label>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</div>
        <div className="mt-1 font-mono text-lg">{preview || "—"}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">Next invoice will use sequence #{nextSeq}.</div>
      </div>
      <Button type="button" onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save invoice settings"}
      </Button>
    </Section>
  );
}
