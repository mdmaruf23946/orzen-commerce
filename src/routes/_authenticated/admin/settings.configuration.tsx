import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  adminGetRequireCustomerLogin,
  adminSetRequireCustomerLogin,
} from "@/lib/admin.functions";
import { InvoiceNumberingSection } from "@/components/admin/settings/InvoiceNumberingSection";
import {
  Section,
  Field,
  SaveBar,
  useStoreForm,
  CURRENCIES,
  LANGUAGES,
  TIMEZONES,
} from "@/components/admin/settings/shared";

export const Route = createFileRoute("/_authenticated/admin/settings/configuration")({
  head: () => ({
    meta: [
      { title: "Store Configuration — ORZEN Merchant Panel" },
      { name: "description", content: "Customer login, localisation and invoice numbering." },
      { property: "og:title", content: "Store Configuration — ORZEN Merchant Panel" },
      { property: "og:description", content: "Customer login, localisation and invoice numbering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreConfigurationPage,
});

function StoreConfigurationPage() {
  const { form, set, submit, saving, dirty } = useStoreForm();
  const getReqLogin = useServerFn(adminGetRequireCustomerLogin);
  const setReqLogin = useServerFn(adminSetRequireCustomerLogin);
  const qc = useQueryClient();
  const [savingLogin, setSavingLogin] = useState(false);

  const { data: reqLogin } = useQuery({
    queryKey: ["admin", "require-customer-login"],
    queryFn: () => getReqLogin(),
  });

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

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

  return (
    <form onSubmit={submit} className="pb-32">
      <div className="mb-5">
        <h1 className="text-xl font-semibold sm:text-2xl">Store Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Checkout login rules, localization and invoice numbering.
        </p>
      </div>

      <div className="space-y-5">
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

        <InvoiceNumberingSection />

        <SaveBar label="Save Store Configuration" saving={saving} dirty={dirty} fixed={false} />
      </div>
    </form>
  );
}
