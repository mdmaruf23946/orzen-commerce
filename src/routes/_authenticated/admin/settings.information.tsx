import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
  Share2,
  Building2,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { resetStoreToTemplate } from "@/lib/admin.functions";
import {
  Section,
  Field,
  IconPreviewCard,
  SaveBar,
  useStoreForm,
} from "@/components/admin/settings/shared";

export const Route = createFileRoute("/_authenticated/admin/settings/information")({
  head: () => ({
    meta: [
      { title: "Store Information — ORZEN Store Admin" },
      { name: "description", content: "Store identity, contact details and branding." },
      { property: "og:title", content: "Store Information — ORZEN Store Admin" },
      { property: "og:description", content: "Store identity, contact details and branding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreInformationPage,
});

function StoreInformationPage() {
  const { form, set, submit, saving, dirty } = useStoreForm();
  const resetFn = useServerFn(resetStoreToTemplate);
  const qc = useQueryClient();
  const [resetting, setResetting] = useState(false);

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

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
    <form onSubmit={submit} className="pb-32">
      <div className="mb-5">
        <h1 className="text-xl font-semibold sm:text-2xl">Store Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identity, icon, contact details and business information.
        </p>
      </div>

      <div className="space-y-5">
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

        <Section
          icon={ImageIcon}
          title="Store Icon & Favicon"
          description="A square icon used for your store identity, browser tab, and PWA icon."
        >
          <Field label="Store icon" hint="Square PNG, JPG or WebP. Recommended 512×512.">
            <ImageUploader
              storeId={form.id}
              folder={form.id ? `${form.id}/branding` : undefined}
              value={form.icon_url ?? null}
              onChange={(v) => set("icon_url", v)}
              accept="image/png,image/jpeg,image/webp"
              maxBytes={2 * 1024 * 1024}
              label="Upload icon"
            />
            {!form.icon_url && (
              <p className="mt-2 text-xs text-muted-foreground">
                Using default store icon (first letter of store name).
              </p>
            )}
          </Field>

          <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Use Store Icon as Favicon</div>
              <div className="text-xs text-muted-foreground">
                Browser tab, apple-touch and PWA icons use your Store Icon automatically.
              </div>
            </div>
            <Switch
              checked={form.use_icon_as_favicon !== false}
              onCheckedChange={(v) => set("use_icon_as_favicon", v)}
            />
          </label>

          {form.use_icon_as_favicon === false && (
            <Field label="Custom favicon" hint="PNG or WebP. Recommended 180×180 or larger.">
              <ImageUploader
                storeId={form.id}
                folder={form.id ? `${form.id}/branding` : undefined}
                value={form.custom_favicon_url ?? null}
                onChange={(v) => set("custom_favicon_url", v)}
                accept="image/png,image/webp,image/x-icon"
                maxBytes={512 * 1024}
                label="Upload favicon"
              />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <IconPreviewCard
              label="Store Admin"
              iconPath={form.icon_url}
              storeName={form.name || "Your Store"}
              subtitle="Store"
            />
            <IconPreviewCard
              label="Browser tab"
              iconPath={
                form.use_icon_as_favicon === false
                  ? (form.custom_favicon_url || form.icon_url)
                  : form.icon_url
              }
              storeName={form.name || "Your Store"}
              browserTab
            />
            <IconPreviewCard
              label="Storefront"
              iconPath={form.icon_url}
              storeName={form.name || "Your Store"}
              subtitle="Home"
            />
          </div>
        </Section>

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

        <SaveBar label="Save Store Information" saving={saving} dirty={dirty} fixed={false} />
      </div>
    </form>
  );
}
