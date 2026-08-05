// Invoice Numbering settings — one independent configuration per order type.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  computeInvoicePreview,
  type InvoiceOrderType,
} from "@/lib/invoice-settings.functions";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { Section, Field } from "./shared";

const TABS = [
  { key: "physical" as const, label: "Physical" },
  { key: "digital" as const, label: "Digital" },
  { key: "service" as const, label: "Service" },
  { key: "subscription" as const, label: "Subscription" },
];

const SAVE_LABEL: Record<InvoiceOrderType, string> = {
  physical: "Save Physical Invoice Settings",
  digital: "Save Digital Invoice Settings",
  service: "Save Service Invoice Settings",
  subscription: "Save Subscription Invoice Settings",
};

export function InvoiceNumberingSection() {
  const [tab, setTab] = useState<InvoiceOrderType>("physical");

  return (
    <Section
      icon={Hash}
      title="Invoice Numbering"
      description="Each order type has its own prefix, separator, padding and starting number."
    >
      <TypeFilterTabs tabs={TABS} value={tab} onChange={setTab} className="static -mx-0 px-0" />
      <InvoiceTypeForm key={tab} orderType={tab} />
    </Section>
  );
}

function InvoiceTypeForm({ orderType }: { orderType: InvoiceOrderType }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getInvoiceSettings);
  const saveFn = useServerFn(updateInvoiceSettings);

  const { data } = useQuery({
    queryKey: ["admin", "invoice-settings", orderType],
    queryFn: () => getFn({ data: { order_type: orderType } }),
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
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const nextSeq = Math.max(Number(data.next_number ?? 1), Number(form.start_number || 1));
  const preview = (() => {
    try {
      return computeInvoicePreview({ ...form, order_type: orderType }, nextSeq);
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
          order_type: orderType,
          prefix: String(form.prefix || "").toUpperCase(),
          separator: form.separator,
          padding: Number(form.padding),
          start_number: Number(form.start_number),
          include_year: !!form.include_year,
          include_month: !!form.include_month,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "invoice-settings", orderType] });
      toast.success("Invoice settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prefix" htmlFor={`inv-prefix-${orderType}`} hint="Letters and digits only, e.g. PH or SUB.">
          <Input
            id={`inv-prefix-${orderType}`}
            maxLength={10}
            value={form.prefix ?? ""}
            onChange={(e) => set("prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </Field>
        <Field label="Separator" htmlFor={`inv-sep-${orderType}`}>
          <select
            id={`inv-sep-${orderType}`}
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
        <Field
          label="Number padding"
          htmlFor={`inv-pad-${orderType}`}
          hint="Zero-pad the sequence to this many digits (4–8)."
        >
          <Input
            id={`inv-pad-${orderType}`}
            type="number"
            min={4}
            max={8}
            value={form.padding}
            onChange={(e) => set("padding", Number(e.target.value))}
          />
        </Field>
        <Field
          label="Starting number"
          htmlFor={`inv-start-${orderType}`}
          hint="Sequence starts here for new invoices."
        >
          <Input
            id={`inv-start-${orderType}`}
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
        <div className="mt-1 text-[11px] text-muted-foreground">
          Next {orderType} invoice will use sequence #{nextSeq}.
        </div>
      </div>
      <Button type="button" onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : SAVE_LABEL[orderType]}
      </Button>
    </div>
  );
}
