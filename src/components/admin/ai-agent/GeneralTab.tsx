import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SectionCard, ToggleRow } from "./ui";
import type { AgentForm } from "./types";

export function GeneralTab({
  form,
  set,
}: {
  form: AgentForm;
  set: <K extends keyof AgentForm>(k: K, v: AgentForm[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionCard title="Agent" description="Basic identity of your store's chat assistant.">
        <ToggleRow
          label="Enable AI agent"
          hint="Turn the chat assistant on or off for your storefront and Messenger."
          checked={form.enabled}
          onChange={(v) => set("enabled", v)}
        />
        <div className={form.enabled ? "space-y-4" : "space-y-4 opacity-60"}>
          <Field label="Agent name">
            <Input value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Short description" hint="One line about the agent's role. Used in its instructions.">
            <Input
              value={form.description}
              maxLength={200}
              placeholder="Helps customers pick products and place orders"
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Messages">
        <Field label="Welcome message">
          <Textarea rows={3} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
        </Field>
        <Field label="Fallback message" hint="Sent when the agent does not know the answer.">
          <Textarea
            rows={3}
            value={form.fallback_message}
            maxLength={500}
            onChange={(e) => set("fallback_message", e.target.value)}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Capabilities">
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Product recommendations"
            hint="Let the agent suggest products from your catalogue."
            checked={form.product_recommendations}
            onChange={(v) => set("product_recommendations", v)}
          />
          <ToggleRow
            label="Order assistance"
            hint="Let the agent take orders and track existing ones."
            checked={form.order_assistance}
            onChange={(v) => set("order_assistance", v)}
          />
        </div>
      </SectionCard>
    </div>
  );
}
