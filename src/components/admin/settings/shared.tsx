// Shared building blocks for the Store Settings sections.
// Extracted from the previous single-page settings route — no logic changes.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getMyStore, updateMyStore } from "@/lib/admin.functions";

export const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "PKR", "AED", "SAR"];
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা" },
  { value: "hi", label: "हिन्दी" },
  { value: "ar", label: "العربية" },
];
export const TIMEZONES = [
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

export function Section({
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

export function Field({
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

/** Loads the store record and keeps a local editable copy. Save payload identical to before. */
export function useStoreForm() {
  const fetchStore = useServerFn(getMyStore);
  const save = useServerFn(updateMyStore);
  const qc = useQueryClient();

  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store && !form) setForm({ ...store });
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!store || !form) return false;
    return JSON.stringify(store) !== JSON.stringify(form);
  }, [store, form]);

  function set<K extends string>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.name?.trim()) return toast.error("Store name is required");
    if (!form?.slug?.trim()) return toast.error("Store slug is required");
    setSaving(true);
    try {
      await save({
        data: {
          name: form.name,
          slug: form.slug,
          description: form.description,
          logo_url: form.logo_url,
          name_logo_url: form.name_logo_url ?? null,
          icon_url: form.icon_url ?? null,
          custom_favicon_url: form.custom_favicon_url ?? null,
          use_icon_as_favicon: form.use_icon_as_favicon !== false,
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
          storefront_lang_switcher: form.storefront_lang_switcher !== false,
          storefront_default_lang: form.storefront_default_lang === "bn" ? "bn" : "en",
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

  return { form, set, submit, saving, dirty };
}

export function SaveBar({
  label,
  saving,
  dirty,
  fixed = true,
}: {
  label: string;
  saving: boolean;
  dirty: boolean;
  fixed?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col-reverse items-stretch gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-xs text-muted-foreground">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button type="submit" disabled={saving || !dirty} className="w-full sm:w-auto sm:min-w-40">
          {saving ? "Saving…" : label}
        </Button>
      </div>

      {fixed && (
        <div className="fixed inset-x-0 bottom-[60px] z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
            <Button type="submit" disabled={saving || !dirty} className="ml-auto min-w-32">
              {saving ? "Saving…" : label}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function iconDisplayUrl(v?: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("http") || v.startsWith("/")) return v;
  return `/api/img/${v}`;
}

export function IconPreviewCard({
  label,
  iconPath,
  storeName,
  subtitle,
  browserTab,
}: {
  label: string;
  iconPath?: string | null;
  storeName: string;
  subtitle?: string;
  browserTab?: boolean;
}) {
  const url = iconDisplayUrl(iconPath);
  const letter = (storeName || "S").charAt(0).toUpperCase();
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {browserTab ? (
        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 shadow-sm">
          {url ? (
            <img src={url} alt="" className="h-4 w-4 rounded-sm object-cover" />
          ) : (
            <div className="grid h-4 w-4 place-items-center rounded-sm bg-primary text-[9px] font-bold text-primary-foreground">
              {letter}
            </div>
          )}
          <div className="truncate text-xs">{storeName}</div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          {url ? (
            <img src={url} alt="" className="h-9 w-9 rounded-md border object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {letter}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{storeName}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
