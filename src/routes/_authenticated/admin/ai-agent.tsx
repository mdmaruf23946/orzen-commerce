import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { getMyAgent, updateMyAgent } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/ai-agent")({
  component: AdminAgent,
});

type Faq = { q: string; a: string };
type Form = {
  enabled: boolean;
  agent_name: string;
  welcome_message: string;
  language: "bn" | "en" | "both";
  style: string;
  use_emoji: boolean;
  human_like: boolean;
  knowledge: {
    store_info: string;
    delivery_policy: string;
    return_policy: string;
    warranty_policy: string;
    payment_methods: string;
    business_hours: string;
    faqs: Faq[];
  };
};

const DEFAULTS: Form = {
  enabled: true,
  agent_name: "Sales Assistant",
  welcome_message: "Hi! How can I help you today?",
  language: "both",
  style: "Friendly and helpful",
  use_emoji: true,
  human_like: true,
  knowledge: {
    store_info: "",
    delivery_policy: "",
    return_policy: "",
    warranty_policy: "",
    payment_methods: "",
    business_hours: "",
    faqs: [],
  },
};

function AdminAgent() {
  const fetchAgent = useServerFn(getMyAgent);
  const save = useServerFn(updateMyAgent);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "agent"], queryFn: () => fetchAgent() });

  const [form, setForm] = useState<Form>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        ...DEFAULTS,
        ...data,
        knowledge: { ...DEFAULTS.knowledge, ...((data as any).knowledge ?? {}) },
      });
    }
  }, [data]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setK<K extends keyof Form["knowledge"]>(k: K, v: Form["knowledge"][K]) {
    setForm((f) => ({ ...f, knowledge: { ...f.knowledge, [k]: v } }));
  }

  async function submit() {
    setSaving(true);
    try {
      await save({ data: form });
      qc.invalidateQueries({ queryKey: ["admin", "agent"] });
      toast.success("Saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Sales Agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your store's chat assistant. The agent only sees your store's data.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 rounded-xl border bg-card p-4">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Enable AI agent</span>
            <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </label>
          <Field label="Agent name">
            <Input value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} />
          </Field>
          <Field label="Welcome message">
            <Textarea
              rows={3}
              value={form.welcome_message}
              onChange={(e) => set("welcome_message", e.target.value)}
            />
          </Field>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Store information">
            <Textarea rows={3} value={form.knowledge.store_info} onChange={(e) => setK("store_info", e.target.value)} />
          </Field>
          <Field label="Delivery policy">
            <Textarea
              rows={3}
              value={form.knowledge.delivery_policy}
              onChange={(e) => setK("delivery_policy", e.target.value)}
            />
          </Field>
          <Field label="Return policy">
            <Textarea
              rows={3}
              value={form.knowledge.return_policy}
              onChange={(e) => setK("return_policy", e.target.value)}
            />
          </Field>
          <Field label="Warranty policy">
            <Textarea
              rows={3}
              value={form.knowledge.warranty_policy}
              onChange={(e) => setK("warranty_policy", e.target.value)}
            />
          </Field>
          <Field label="Payment methods">
            <Textarea
              rows={2}
              value={form.knowledge.payment_methods}
              onChange={(e) => setK("payment_methods", e.target.value)}
            />
          </Field>
          <Field label="Business hours">
            <Input
              value={form.knowledge.business_hours}
              onChange={(e) => setK("business_hours", e.target.value)}
              placeholder="Sat–Thu 10am–9pm"
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">FAQs</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setK("faqs", [...form.knowledge.faqs, { q: "", a: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {form.knowledge.faqs.map((f, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
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
                  onClick={() => setK("faqs", form.knowledge.faqs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Language">
            <select
              value={form.language}
              onChange={(e) => set("language", e.target.value as Form["language"])}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="bn">Bangla</option>
              <option value="en">English</option>
              <option value="both">Both (auto)</option>
            </select>
          </Field>
          <Field label="Communication style">
            <Input value={form.style} onChange={(e) => set("style", e.target.value)} />
          </Field>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Use emojis</span>
            <Switch checked={form.use_emoji} onCheckedChange={(v) => set("use_emoji", v)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Human-like conversation</span>
            <Switch checked={form.human_like} onCheckedChange={(v) => set("human_like", v)} />
          </label>
        </TabsContent>
      </Tabs>

      <Button onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
