import { Link } from "@tanstack/react-router";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, ToggleRow } from "./ui";
import type { AgentForm, AgentSources, KnowledgeSummary } from "./types";

type SourceDef = {
  key: keyof AgentSources;
  label: string;
  preview: (s: KnowledgeSummary | undefined) => string;
  to?: string;
  noteKey?: keyof AgentForm["knowledge"];
  noteLabel?: string;
};

const SOURCES: SourceDef[] = [
  {
    key: "products",
    label: "Products & prices",
    preview: (s) => (s ? `${s.products_active} active of ${s.products_total} products` : "—"),
    to: "/admin/products",
  },
  {
    key: "stock",
    label: "Stock & availability",
    preview: () => "Live stock from your inventory",
    to: "/admin/inventory",
  },
  {
    key: "categories",
    label: "Categories",
    preview: (s) => (s ? `${s.categories_total} categories` : "—"),
    to: "/admin/categories",
  },
  {
    key: "delivery",
    label: "Delivery information",
    preview: (s) =>
      s && s.delivery_zones.length
        ? s.delivery_zones.map((z) => `${z.name} ৳${z.charge}`).join(" · ")
        : "No delivery zones configured",
    to: "/admin/settings",
    noteKey: "delivery_policy",
    noteLabel: "Extra delivery notes",
  },
  {
    key: "payments",
    label: "Payment methods",
    preview: (s) => (s && s.payment_gateways.length ? s.payment_gateways.join(", ") : "No gateway enabled"),
    to: "/admin/payments",
    noteKey: "payment_methods",
    noteLabel: "Extra payment notes",
  },
  {
    key: "returns",
    label: "Return & exchange policy",
    preview: (s) =>
      s?.returns.enabled
        ? `Returns ${s.returns.return_window_days ?? "-"} days · Exchange ${s.returns.exchange_window_days ?? "-"} days`
        : "Returns disabled",
    to: "/admin/returns",
    noteKey: "return_policy",
    noteLabel: "Extra return notes",
  },
  {
    key: "warranty",
    label: "Warranty information",
    preview: () => "From product warranty fields",
    noteKey: "warranty_policy",
    noteLabel: "Warranty notes",
  },
  {
    key: "store_info",
    label: "Store information",
    preview: (s) => (s ? [s.store.name, s.store.phone, s.store.address].filter(Boolean).join(" · ") || "—" : "—"),
    to: "/admin/settings",
    noteKey: "store_info",
    noteLabel: "Extra store notes",
  },
  {
    key: "business_hours",
    label: "Business hours",
    preview: () => "Shown to customers when asked",
    noteKey: "business_hours",
    noteLabel: "Business hours",
  },
];

export function KnowledgeTab({
  form,
  setSource,
  setK,
  summary,
}: {
  form: AgentForm;
  setSource: (k: keyof AgentSources, v: boolean) => void;
  setK: <K extends keyof AgentForm["knowledge"]>(k: K, v: AgentForm["knowledge"][K]) => void;
  summary?: KnowledgeSummary;
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Store data the agent can use"
        description="The agent reads this live from your store — no need to type it again."
      >
        <div className="space-y-2">
          {SOURCES.map((s) => {
            const enabled = form.sources[s.key];
            const noteValue = s.noteKey ? form.knowledge[s.noteKey] : "";
            return (
              <div key={s.key} className="rounded-lg border bg-background/50">
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.preview(summary)}</p>
                    {s.to ? (
                      <Link to={s.to} className="mt-1 inline-block text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    ) : null}
                  </div>
                  <ToggleRowInline checked={enabled} onChange={(v) => setSource(s.key, v)} />
                </div>
                {s.noteKey ? (
                  <details className="border-t px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
                      <ChevronDown className="h-3 w-3" /> {s.noteLabel}
                      {typeof noteValue === "string" && noteValue.trim() ? " (filled)" : ""}
                    </summary>
                    <Textarea
                      className="mt-2"
                      rows={3}
                      value={typeof noteValue === "string" ? noteValue : ""}
                      placeholder="Optional — only add what is not already in your store settings"
                      onChange={(e) => setK(s.noteKey as any, e.target.value as any)}
                    />
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="FAQs" description="Add questions customers ask often, with the exact answer to give.">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setK("faqs", [...form.knowledge.faqs, { q: "", a: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add FAQ
        </Button>
        {form.knowledge.faqs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No FAQ added yet.</p>
        ) : null}
        <div className="space-y-2">
          {form.knowledge.faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <Input
                placeholder="Question"
                value={f.q}
                onChange={(e) => {
                  const next = [...form.knowledge.faqs];
                  next[i] = { ...next[i], q: e.target.value };
                  setK("faqs", next);
                }}
              />
              <Textarea
                rows={2}
                placeholder="Answer"
                value={f.a}
                onChange={(e) => {
                  const next = [...form.knowledge.faqs];
                  next[i] = { ...next[i], a: e.target.value };
                  setK("faqs", next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setK("faqs", form.knowledge.faqs.filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ToggleRowInline({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <ToggleRow label="" checked={checked} onChange={onChange} />;
}
