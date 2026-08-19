import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, SectionCard } from "./ui";
import type { AgentForm } from "./types";
import {
  CONFIRMATION_PLACEHOLDERS,
  ORDER_FIELD_KEYS,
  ORDER_FIELD_LABELS,
  type OrderFieldKey,
  type OrderFlowConfig,
} from "@/lib/messenger-order-flow";

const LOCKED: OrderFieldKey[] = ["customer_name", "phone"];

export function OrderingTab({
  form,
  setOrderFlow,
  paymentMethods,
}: {
  form: AgentForm;
  setOrderFlow: <K extends keyof OrderFlowConfig>(k: K, v: OrderFlowConfig[K]) => void;
  paymentMethods?: { id: string; label: string }[];
}) {
  const of = form.order_flow;

  function setField(key: OrderFieldKey, patch: Partial<{ enabled: boolean; required: boolean }>) {
    const next = { ...of.fields, [key]: { ...of.fields[key], ...patch } };
    if (patch.enabled === false) next[key] = { enabled: false, required: false };
    setOrderFlow("fields", next);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Buy Now message"
        description="Sent right after a customer taps Buy Now on a physical product card in Messenger."
      >
        <Textarea
          rows={3}
          value={of.buy_now_message}
          onChange={(e) => setOrderFlow("buy_now_message", e.target.value)}
          placeholder="ঠিক আছে, অর্ডারটি কনফার্ম করতে কয়েকটি তথ্য প্রয়োজন।"
        />
      </SectionCard>

      <SectionCard
        title="Customer information"
        description="Choose what the agent collects. Required details must be given before the order is created; optional ones are asked once and never block confirmation."
      >
        <div className="space-y-2">
          {ORDER_FIELD_KEYS.map((key) => {
            const f = of.fields[key];
            const locked = LOCKED.includes(key);
            return (
              <div
                key={key}
                className="flex flex-col gap-2 rounded-lg border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ORDER_FIELD_LABELS[key]}</p>
                  {locked ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Always collected.</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Collect
                    <Switch
                      checked={f.enabled}
                      disabled={locked}
                      onCheckedChange={(v) => setField(key, { enabled: v })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Required
                    <Switch
                      checked={f.required}
                      disabled={locked || !f.enabled}
                      onCheckedChange={(v) => setField(key, { required: v })}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Collection style">
        <Field label="How the agent asks">
          <select
            value={of.collection_style}
            onChange={(e) => setOrderFlow("collection_style", e.target.value as OrderFlowConfig["collection_style"])}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="one_by_one">One question at a time (recommended)</option>
            <option value="combined">Ask for everything in one message</option>
          </select>
        </Field>
      </SectionCard>

      <SectionCard
        title="Order confirmation message"
        description="Sent once the order is created. Placeholders with no value are removed automatically."
      >
        <Textarea
          rows={4}
          value={of.confirmation_message}
          onChange={(e) => setOrderFlow("confirmation_message", e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {CONFIRMATION_PLACEHOLDERS.map((p) => (
            <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{`{{${p}}}`}</code>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Payment methods"
        description="The agent may only offer the methods enabled in your Payment settings."
      >
        {paymentMethods && paymentMethods.length ? (
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((m) => (
              <span key={m.id} className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs">
                {m.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No manual payment method is enabled yet. Enable Cash on Delivery or a manual method in Payment settings.
          </p>
        )}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Messenger checkout applies to physical products only. Digital, service and subscription products are always
        completed on your website.
      </p>
    </div>
  );
}
