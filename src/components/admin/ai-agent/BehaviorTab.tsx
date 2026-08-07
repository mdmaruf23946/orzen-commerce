import { Lock } from "lucide-react";
import { Field, SectionCard, ToggleRow } from "./ui";
import type { AgentForm } from "./types";

const STYLES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

export function BehaviorTab({
  form,
  set,
}: {
  form: AgentForm;
  set: <K extends keyof AgentForm>(k: K, v: AgentForm[K]) => void;
}) {
  const styleValue = STYLES.some((s) => s.value === form.style) ? form.style : "friendly";
  return (
    <div className="space-y-4">
      <SectionCard title="Tone">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language">
            <select
              value={form.language}
              onChange={(e) => set("language", e.target.value as AgentForm["language"])}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="bn">Bangla</option>
              <option value="en">English</option>
              <option value="both">Both (auto)</option>
            </select>
          </Field>
          <Field label="Communication style">
            <select
              value={styleValue}
              onChange={(e) => set("style", e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Human-like conversation"
            hint="Natural wording instead of robotic replies."
            checked={form.human_like}
            onChange={(v) => set("human_like", v)}
          />
          <ToggleRow label="Use emojis" checked={form.use_emoji} onChange={(v) => set("use_emoji", v)} />
        </div>
      </SectionCard>

      <SectionCard title="Selling">
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Sales-focused responses"
            hint="Guide the customer toward a purchase."
            checked={form.sales_focused}
            onChange={(v) => set("sales_focused", v)}
          />
          <ToggleRow
            label="Recommend related products"
            hint="Offer matching add-ons after a product."
            checked={form.recommend_related}
            onChange={(v) => set("recommend_related", v)}
            disabled={!form.product_recommendations}
          />
          <ToggleRow
            label="Ask customer for required information"
            hint="Ask one short question when details are missing."
            checked={form.ask_for_info}
            onChange={(v) => set("ask_for_info", v)}
          />
          <ToggleRow
            label="Escalate to human/admin"
            hint="Hand over when the agent cannot help."
            checked={form.escalate_to_human}
            onChange={(v) => set("escalate_to_human", v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Accuracy">
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Lock className="h-3.5 w-3.5" /> Never invent information
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Always on. The agent may only use your real store data — never made-up prices, stock, delivery charges or
              policies. When it does not know, it says so and can point the customer to you.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
