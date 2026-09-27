import { createFileRoute } from "@tanstack/react-router";
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
  Share2,
  Building2,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/ImageUploader";
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
      { title: "Store Information — ORZEN Merchant Panel" },
      { name: "description", content: "Store identity, contact details and branding." },
      { property: "og:title", content: "Store Information — ORZEN Merchant Panel" },
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

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store logo" hint="Square logo shown next to your store name.">
              <ImageUploader storeId={form.id} value={form.logo_url} onChange={(v) => set("logo_url", v)} />
            </Field>
            <Field
              label="Store name logo"
              hint="Wordmark image shown in the storefront header instead of the text name. Leave empty to show text."
            >
              <ImageUploader
                storeId={form.id}
                value={form.name_logo_url ?? null}
                onChange={(v) => set("name_logo_url", v)}
                label="Upload name logo"
                wide
              />
              {!form.name_logo_url && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Currently showing the store name as text.
                </p>
              )}
            </Field>
          </div>
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
          {(form as any).merchant_code && (
            <Field
              label="Merchant code"
              hint="Your permanent identification code. Used for identifying your store and your customers only — never as an invoice or payment number."
            >
              <Input readOnly disabled className="font-mono" value={(form as any).merchant_code} />
            </Field>
          )}
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
              label="Merchant Panel"
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
              ["whatsapp", "WhatsApp number / link", "https://wa.me/8801XXXXXXXXX"],
              ["messenger", "Messenger link", "https://m.me/yourpage"],
              ["telegram", "Telegram username / link", "https://t.me/yourhandle"],
              ["twitter", "X (Twitter)", "https://x.com/yourhandle"],
              ["pinterest", "Pinterest", "https://pinterest.com/yourbrand"],
              ["snapchat", "Snapchat", "https://snapchat.com/add/yourhandle"],
              ["threads", "Threads", "https://threads.net/@yourhandle"],
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

        <SaveBar label="Save Store Information" saving={saving} dirty={dirty} fixed={false} />
      </div>
    </form>
  );
}
