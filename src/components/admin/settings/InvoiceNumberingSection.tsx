// Invoice Numbering settings — moved verbatim from the old single settings page.
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
} from "@/lib/invoice-settings.functions";
import { Section, Field } from "./shared";

export function InvoiceNumberingSection() {
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
