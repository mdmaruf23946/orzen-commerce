// Return & Exchange policy — Store Settings → Order & Workflow.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Section, Field } from "@/components/admin/settings/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getReturnSettings, saveReturnSettings } from "@/lib/returns-admin.functions";
import { DEFAULT_POLICY } from "@/lib/returns-pricing";

type Form = {
  enabled: boolean;
  eligibility_days: number;
  allow_return: boolean;
  allow_exchange_same: boolean;
  allow_exchange_other: boolean;
  return_shipping_payer: "store" | "customer";
  return_shipping_charge: number;
  replacement_shipping_payer: "store" | "customer";
  replacement_shipping_charge: number;
  restocking_fee_type: "none" | "percent" | "flat";
  restocking_fee_value: number;
  require_inspection: boolean;
  auto_approve_under: number | null;
  policy_note: string | null;
};

const BASE: Form = {
  ...DEFAULT_POLICY,
  policy_note: null,
  require_inspection: true,
  auto_approve_under: null,
} as Form;

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ReturnPolicySection() {
  const load = useServerFn(getReturnSettings);
  const save = useServerFn(saveReturnSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "return-settings"], queryFn: () => load() });

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) {
      const d = data as any;
      setForm({
        ...BASE,
        ...d,
        auto_approve_under: d.auto_approve_under ?? null,
        policy_note: d.policy_note ?? null,
        require_inspection: d.require_inspection !== false,
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function submit() {
    if (!form) return;
    setSaving(true);
    try {
      await save({
        data: {
          enabled: !!form.enabled,
          eligibility_days: Number(form.eligibility_days) || 0,
          allow_return: !!form.allow_return,
          allow_exchange_same: !!form.allow_exchange_same,
          allow_exchange_other: !!form.allow_exchange_other,
          return_shipping_payer: form.return_shipping_payer,
          return_shipping_charge: Number(form.return_shipping_charge) || 0,
          replacement_shipping_payer: form.replacement_shipping_payer,
          replacement_shipping_charge: Number(form.replacement_shipping_charge) || 0,
          restocking_fee_type: form.restocking_fee_type,
          restocking_fee_value: Number(form.restocking_fee_value) || 0,
          require_inspection: !!form.require_inspection,
          auto_approve_under:
            form.auto_approve_under === null || form.auto_approve_under === undefined
              ? null
              : Number(form.auto_approve_under),
          policy_note: form.policy_note?.trim() ? form.policy_note.trim() : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "return-settings"] });
      toast.success("Return policy saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Section icon={RotateCcw} title="Return &amp; Exchange policy">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  return (
    <Section
      icon={RotateCcw}
      title="Return &amp; Exchange policy"
      description="Controls what customers can request from their order page and how the money is calculated."
    >
      <Toggle
        label="Enable returns & exchanges"
        hint="Turn off to hide the request button on the storefront."
        checked={form.enabled}
        onChange={(v) => set("enabled", v)}
      />

      <Field label="Eligibility window (days after delivery)">
        <Input
          type="number"
          min={0}
          value={form.eligibility_days}
          onChange={(e) => set("eligibility_days", Number(e.target.value))}
        />
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">Allowed request types</p>
        <Toggle
          label="Return only (refund)"
          checked={form.allow_return}
          onChange={(v) => set("allow_return", v)}
        />
        <Toggle
          label="Exchange — same product"
          hint="Swap for another variant of the ordered item."
          checked={form.allow_exchange_same}
          onChange={(v) => set("allow_exchange_same", v)}
        />
        <Toggle
          label="Exchange — different product"
          hint="Pick any other product from the catalogue."
          checked={form.allow_exchange_other}
          onChange={(v) => set("allow_exchange_other", v)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Return shipping paid by">
          <select
            value={form.return_shipping_payer}
            onChange={(e) => set("return_shipping_payer", e.target.value as any)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="store">Store</option>
            <option value="customer">Customer</option>
          </select>
        </Field>
        <Field label="Return shipping charge (৳)">
          <Input
            type="number"
            min={0}
            value={form.return_shipping_charge}
            onChange={(e) => set("return_shipping_charge", Number(e.target.value))}
          />
        </Field>
        <Field label="Replacement shipping paid by">
          <select
            value={form.replacement_shipping_payer}
            onChange={(e) => set("replacement_shipping_payer", e.target.value as any)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="store">Store</option>
            <option value="customer">Customer</option>
          </select>
        </Field>
        <Field label="Replacement shipping charge (৳)">
          <Input
            type="number"
            min={0}
            value={form.replacement_shipping_charge}
            onChange={(e) => set("replacement_shipping_charge", Number(e.target.value))}
          />
        </Field>
        <Field label="Restocking fee">
          <select
            value={form.restocking_fee_type}
            onChange={(e) => set("restocking_fee_type", e.target.value as any)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="none">No fee</option>
            <option value="percent">Percent of returned value</option>
            <option value="flat">Flat amount</option>
          </select>
        </Field>
        <Field label={form.restocking_fee_type === "percent" ? "Fee (%)" : "Fee (৳)"}>
          <Input
            type="number"
            min={0}
            disabled={form.restocking_fee_type === "none"}
            value={form.restocking_fee_value}
            onChange={(e) => set("restocking_fee_value", Number(e.target.value))}
          />
        </Field>
      </div>

      <Toggle
        label="Require inspection before refund or replacement"
        hint="Recommended. Stock only moves back after a passed inspection."
        checked={form.require_inspection}
        onChange={(v) => set("require_inspection", v)}
      />

      <Field
        label="Auto-approve requests under (৳)"
        hint="Leave empty to review every request manually."
      >
        <Input
          type="number"
          min={0}
          value={form.auto_approve_under ?? ""}
          onChange={(e) =>
            set("auto_approve_under", e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </Field>

      <Field label="Policy note shown to customers">
        <Textarea
          rows={3}
          value={form.policy_note ?? ""}
          onChange={(e) => set("policy_note", e.target.value)}
          placeholder="Items must be unused with original packaging…"
        />
      </Field>

      <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save return policy"}
      </Button>
    </Section>
  );
}
