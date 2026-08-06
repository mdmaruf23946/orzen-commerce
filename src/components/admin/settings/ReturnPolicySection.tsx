// Returns & Exchanges — global store settings.
// Used both in Store Settings → Order & Workflow and in the settings drawer on
// the Returns dashboard.
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
import {
  DEFAULT_AUTO_WORKFLOW,
  DEFAULT_EXCHANGE_RULES,
  DEFAULT_POLICY,
  type AutoWorkflow,
  type ExchangeRules,
  type ShippingMode,
} from "@/lib/returns-pricing";

type RefundMethod = "original" | "store_credit" | "manual" | "cod_adjust";

type Form = {
  enabled: boolean;
  eligibility_days: number;
  exchange_window_days: number;
  allow_return: boolean;
  allow_exchange_same: boolean;
  allow_exchange_other: boolean;
  return_shipping_mode: ShippingMode;
  return_shipping_charge: number;
  return_split_customer: number;
  return_split_store: number;
  replacement_shipping_mode: ShippingMode;
  replacement_shipping_charge: number;
  replacement_split_customer: number;
  replacement_split_store: number;
  restocking_fee_type: "none" | "percent" | "flat";
  restocking_fee_value: number;
  exchange_rules: ExchangeRules;
  replacement_source: "cart" | "wishlist" | "all";
  customer_pays_difference: boolean;
  refund_direction: "refund_bank" | "store_credit" | "no_refund";
  refund_methods: RefundMethod[];
  require_admin_approval: boolean;
  require_inspection: boolean;
  require_photo: boolean;
  require_courier_tracking: boolean;
  auto_workflow: AutoWorkflow;
  auto_approve_under: number | null;
  policy_note: string | null;
};

const BASE: Form = {
  enabled: DEFAULT_POLICY.enabled,
  eligibility_days: DEFAULT_POLICY.eligibility_days,
  exchange_window_days: DEFAULT_POLICY.exchange_window_days,
  allow_return: true,
  allow_exchange_same: true,
  allow_exchange_other: true,
  return_shipping_mode: "customer",
  return_shipping_charge: 0,
  return_split_customer: 0,
  return_split_store: 0,
  replacement_shipping_mode: "store",
  replacement_shipping_charge: 0,
  replacement_split_customer: 0,
  replacement_split_store: 0,
  restocking_fee_type: "none",
  restocking_fee_value: 0,
  exchange_rules: DEFAULT_EXCHANGE_RULES,
  replacement_source: "cart",
  customer_pays_difference: true,
  refund_direction: "refund_bank",
  refund_methods: ["original", "store_credit", "manual"],
  require_admin_approval: true,
  require_inspection: true,
  require_photo: false,
  require_courier_tracking: false,
  auto_workflow: DEFAULT_AUTO_WORKFLOW,
  auto_approve_under: null,
  policy_note: null,
};

const SHIPPING_MODES: { value: ShippingMode; label: string }[] = [
  { value: "customer", label: "Customer pays" },
  { value: "store", label: "Store pays" },
  { value: "split", label: "Split (both pay)" },
  { value: "free", label: "Free shipping" },
];

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: "original", label: "Original payment method" },
  { value: "store_credit", label: "Store credit / wallet" },
  { value: "manual", label: "Manual / cash / bKash" },
  { value: "cod_adjust", label: "COD adjustment" },
];

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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
        exchange_rules: { ...DEFAULT_EXCHANGE_RULES, ...(d.exchange_rules ?? {}) },
        auto_workflow: { ...DEFAULT_AUTO_WORKFLOW, ...(d.auto_workflow ?? {}) },
        refund_methods: (d.refund_methods?.length ? d.refund_methods : BASE.refund_methods) as RefundMethod[],
        auto_approve_under: d.auto_approve_under ?? null,
        policy_note: d.policy_note ?? null,
        require_inspection: d.require_inspection !== false,
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function setRule<K extends keyof ExchangeRules>(k: K, v: boolean) {
    setForm((f) => (f ? { ...f, exchange_rules: { ...f.exchange_rules, [k]: v } } : f));
  }
  function setAuto<K extends keyof AutoWorkflow>(k: K, v: boolean) {
    setForm((f) => (f ? { ...f, auto_workflow: { ...f.auto_workflow, [k]: v } } : f));
  }
  function toggleMethod(m: RefundMethod, on: boolean) {
    setForm((f) =>
      f
        ? {
            ...f,
            refund_methods: on
              ? Array.from(new Set([...f.refund_methods, m]))
              : f.refund_methods.filter((x) => x !== m),
          }
        : f,
    );
  }

  async function submit() {
    if (!form) return;
    setSaving(true);
    try {
      await save({
        data: {
          enabled: !!form.enabled,
          eligibility_days: Number(form.eligibility_days) || 0,
          exchange_window_days: Number(form.exchange_window_days) || 0,
          allow_return: !!form.allow_return,
          allow_exchange_same: !!form.allow_exchange_same,
          allow_exchange_other: !!form.allow_exchange_other,
          return_shipping_mode: form.return_shipping_mode,
          return_shipping_charge: Number(form.return_shipping_charge) || 0,
          return_split_customer: Number(form.return_split_customer) || 0,
          return_split_store: Number(form.return_split_store) || 0,
          replacement_shipping_mode: form.replacement_shipping_mode,
          replacement_shipping_charge: Number(form.replacement_shipping_charge) || 0,
          replacement_split_customer: Number(form.replacement_split_customer) || 0,
          replacement_split_store: Number(form.replacement_split_store) || 0,
          // legacy payer columns kept in sync for older readers
          return_shipping_payer: form.return_shipping_mode === "customer" ? "customer" : "store",
          replacement_shipping_payer:
            form.replacement_shipping_mode === "customer" ? "customer" : "store",
          restocking_fee_type: form.restocking_fee_type,
          restocking_fee_value: Number(form.restocking_fee_value) || 0,
          exchange_rules: form.exchange_rules,
          replacement_source: form.replacement_source,
          customer_pays_difference: !!form.customer_pays_difference,
          refund_direction: form.refund_direction,
          refund_methods: form.refund_methods,
          require_admin_approval: !!form.require_admin_approval,
          require_inspection: !!form.require_inspection,
          require_photo: !!form.require_photo,
          require_courier_tracking: !!form.require_courier_tracking,
          auto_workflow: form.auto_workflow,
          auto_approve_under:
            form.auto_approve_under === null || form.auto_approve_under === undefined
              ? null
              : Number(form.auto_approve_under),
          policy_note: form.policy_note?.trim() ? form.policy_note.trim() : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "return-settings"] });
      toast.success("Return & exchange settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <Section icon={RotateCcw} title="Return &amp; Exchange settings">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  return (
    <Section
      icon={RotateCcw}
      title="Return &amp; Exchange settings"
      description="One global configuration for every return and exchange request in this store."
    >
      <Toggle
        label="Enable returns & exchanges"
        hint="Turn off to hide the request button on the storefront."
        checked={form.enabled}
        onChange={(v) => set("enabled", v)}
      />

      <Group title="Request windows">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Return window (days after delivery)">
            <Input
              type="number"
              min={0}
              value={form.eligibility_days}
              onChange={(e) => set("eligibility_days", Number(e.target.value))}
            />
          </Field>
          <Field label="Exchange window (days after delivery)">
            <Input
              type="number"
              min={0}
              value={form.exchange_window_days}
              onChange={(e) => set("exchange_window_days", Number(e.target.value))}
            />
          </Field>
        </div>
      </Group>

      <Group title="Allowed request types">
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
          hint="Pick another product instead."
          checked={form.allow_exchange_other}
          onChange={(v) => set("allow_exchange_other", v)}
        />
      </Group>

      <Group title="Return shipping cost">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Who pays">
            <Select
              value={form.return_shipping_mode}
              onChange={(v) => set("return_shipping_mode", v as ShippingMode)}
              options={SHIPPING_MODES}
            />
          </Field>
          {form.return_shipping_mode !== "free" && form.return_shipping_mode !== "split" && (
            <Field label="Return shipping charge (৳)">
              <Input
                type="number"
                min={0}
                value={form.return_shipping_charge}
                onChange={(e) => set("return_shipping_charge", Number(e.target.value))}
              />
            </Field>
          )}
          {form.return_shipping_mode === "split" && (
            <>
              <Field label="Customer pays (৳)">
                <Input
                  type="number"
                  min={0}
                  value={form.return_split_customer}
                  onChange={(e) => set("return_split_customer", Number(e.target.value))}
                />
              </Field>
              <Field label="Store pays (৳)">
                <Input
                  type="number"
                  min={0}
                  value={form.return_split_store}
                  onChange={(e) => set("return_split_store", Number(e.target.value))}
                />
              </Field>
            </>
          )}
        </div>
      </Group>

      <Group title="Replacement shipping cost">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Who pays">
            <Select
              value={form.replacement_shipping_mode}
              onChange={(v) => set("replacement_shipping_mode", v as ShippingMode)}
              options={SHIPPING_MODES}
            />
          </Field>
          {form.replacement_shipping_mode !== "free" &&
            form.replacement_shipping_mode !== "split" && (
              <Field label="Replacement shipping charge (৳)">
                <Input
                  type="number"
                  min={0}
                  value={form.replacement_shipping_charge}
                  onChange={(e) => set("replacement_shipping_charge", Number(e.target.value))}
                />
              </Field>
            )}
          {form.replacement_shipping_mode === "split" && (
            <>
              <Field label="Customer pays (৳)">
                <Input
                  type="number"
                  min={0}
                  value={form.replacement_split_customer}
                  onChange={(e) => set("replacement_split_customer", Number(e.target.value))}
                />
              </Field>
              <Field label="Store pays (৳)">
                <Input
                  type="number"
                  min={0}
                  value={form.replacement_split_store}
                  onChange={(e) => set("replacement_split_store", Number(e.target.value))}
                />
              </Field>
            </>
          )}
        </div>
      </Group>

      <Group title="Restocking fee">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fee type">
            <Select
              value={form.restocking_fee_type}
              onChange={(v) => set("restocking_fee_type", v as any)}
              options={[
                { value: "none", label: "No fee" },
                { value: "percent", label: "Percent of returned value" },
                { value: "flat", label: "Flat amount" },
              ]}
            />
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
      </Group>

      <Group title="Exchange rules">
        <Toggle
          label="Same product, same variant"
          checked={form.exchange_rules.same_variant}
          onChange={(v) => setRule("same_variant", v)}
        />
        <Toggle
          label="Same product, different variant"
          checked={form.exchange_rules.different_variant}
          onChange={(v) => setRule("different_variant", v)}
        />
        <Toggle
          label="Different product"
          checked={form.exchange_rules.different_product}
          onChange={(v) => setRule("different_product", v)}
        />
        <Toggle
          label="Allow higher priced replacement"
          checked={form.exchange_rules.higher_price}
          onChange={(v) => setRule("higher_price", v)}
        />
        <Toggle
          label="Allow lower priced replacement"
          checked={form.exchange_rules.lower_price}
          onChange={(v) => setRule("lower_price", v)}
        />
        <Toggle
          label="Allow equal priced replacement"
          checked={form.exchange_rules.equal_price}
          onChange={(v) => setRule("equal_price", v)}
        />
      </Group>

      <Group title="Replacement product source">
        <Field label="Customers can pick replacements from">
          <Select
            value={form.replacement_source}
            onChange={(v) => set("replacement_source", v as any)}
            options={[
              { value: "cart", label: "Ordered items only" },
              { value: "wishlist", label: "Wishlist products" },
              { value: "all", label: "All store products" },
            ]}
          />
        </Field>
      </Group>

      <Group title="Payment adjustment">
        <Toggle
          label="Customer pays the price difference"
          hint="When the replacement costs more. Turn off to let the store absorb it."
          checked={form.customer_pays_difference}
          onChange={(v) => set("customer_pays_difference", v)}
        />
        <Field label="When the replacement costs less">
          <Select
            value={form.refund_direction}
            onChange={(v) => set("refund_direction", v as any)}
            options={[
              { value: "refund_bank", label: "Refund the difference" },
              { value: "store_credit", label: "Give store credit" },
              { value: "no_refund", label: "No refund" },
            ]}
          />
        </Field>
      </Group>

      <Group title="Refund methods offered">
        {REFUND_METHODS.map((m) => (
          <Toggle
            key={m.value}
            label={m.label}
            checked={form.refund_methods.includes(m.value)}
            onChange={(v) => toggleMethod(m.value, v)}
          />
        ))}
      </Group>

      <Group title="Approval & verification">
        <Toggle
          label="Require admin approval"
          hint="Turn off to auto-approve every eligible request."
          checked={form.require_admin_approval}
          onChange={(v) => set("require_admin_approval", v)}
        />
        <Toggle
          label="Require inspection before refund or replacement"
          hint="Stock only moves back after a passed inspection."
          checked={form.require_inspection}
          onChange={(v) => set("require_inspection", v)}
        />
        <Toggle
          label="Require product photo from the customer"
          checked={form.require_photo}
          onChange={(v) => set("require_photo", v)}
        />
        <Toggle
          label="Require courier tracking for the return parcel"
          checked={form.require_courier_tracking}
          onChange={(v) => set("require_courier_tracking", v)}
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
      </Group>

      <Group title="Automatic workflow">
        <Toggle
          label="Auto create return courier parcel"
          checked={form.auto_workflow.return_courier}
          onChange={(v) => setAuto("return_courier", v)}
        />
        <Toggle
          label="Auto create replacement order"
          checked={form.auto_workflow.replacement_order}
          onChange={(v) => setAuto("replacement_order", v)}
        />
        <Toggle
          label="Auto reserve replacement stock"
          checked={form.auto_workflow.reserve_stock}
          onChange={(v) => setAuto("reserve_stock", v)}
        />
        <Toggle
          label="Auto update inventory after inspection"
          checked={form.auto_workflow.update_inventory}
          onChange={(v) => setAuto("update_inventory", v)}
        />
        <Toggle
          label="Auto notify the customer at every stage"
          checked={form.auto_workflow.notify_customer}
          onChange={(v) => setAuto("notify_customer", v)}
        />
        <Toggle
          label="Auto sync courier tracking"
          checked={form.auto_workflow.sync_tracking}
          onChange={(v) => setAuto("sync_tracking", v)}
        />
      </Group>

      <Field label="Policy note shown to customers">
        <Textarea
          rows={3}
          value={form.policy_note ?? ""}
          onChange={(e) => set("policy_note", e.target.value)}
          placeholder="Items must be unused with original packaging…"
        />
      </Field>

      <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </Section>
  );
}
