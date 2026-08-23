import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyAgent, updateMyAgent, getMyAgentKnowledgeSummary, getMyMessengerPaymentMethods } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab } from "@/components/admin/ai-agent/GeneralTab";
import { KnowledgeTab } from "@/components/admin/ai-agent/KnowledgeTab";
import { BehaviorTab } from "@/components/admin/ai-agent/BehaviorTab";
import { OrderingTab } from "@/components/admin/ai-agent/OrderingTab";
import { normalizeOrderFlow, type OrderFlowConfig } from "@/lib/messenger-order-flow";
import { AGENT_DEFAULTS, type AgentForm, type AgentSources, type KnowledgeSummary } from "@/components/admin/ai-agent/types";

export const Route = createFileRoute("/_authenticated/admin/ai-agent")({
  head: () => ({
    meta: [
      { title: "AI Sales Agent — ORZEN Store Admin" },
      { name: "description", content: "Configure your store's AI sales agent, knowledge base and behaviour." },
      { property: "og:title", content: "AI Sales Agent — ORZEN Store Admin" },
      { property: "og:description", content: "Configure your store's AI sales agent, knowledge base and behaviour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <AdminAgent />
    </FeatureGate>
  ),
});

function AdminAgent() {
  const fetchAgent = useServerFn(getMyAgent);
  const fetchSummary = useServerFn(getMyAgentKnowledgeSummary);
  const fetchPayments = useServerFn(getMyMessengerPaymentMethods);
  const save = useServerFn(updateMyAgent);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "agent"], queryFn: () => fetchAgent() });
  const { data: summary } = useQuery({
    queryKey: ["admin", "agent", "knowledge-summary"],
    queryFn: () => fetchSummary() as Promise<KnowledgeSummary>,
    staleTime: 60_000,
  });
  const { data: paymentMethods } = useQuery({
    queryKey: ["admin", "agent", "payment-methods"],
    queryFn: () => fetchPayments() as Promise<{ id: string; label: string }[]>,
    staleTime: 60_000,
  });

  const [form, setForm] = useState<AgentForm>(AGENT_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const d = data as any;
    setForm({
      ...AGENT_DEFAULTS,
      ...d,
      description: d.description ?? "",
      fallback_message: d.fallback_message || AGENT_DEFAULTS.fallback_message,
      language: (["bn", "en", "both"].includes(d.language) ? d.language : "both") as AgentForm["language"],
      sources: { ...AGENT_DEFAULTS.sources, ...((d.sources ?? {}) as Partial<AgentSources>) },
      order_flow: normalizeOrderFlow(d.order_flow),
      knowledge: { ...AGENT_DEFAULTS.knowledge, ...(d.knowledge ?? {}) },
    });
  }, [data]);

  function set<K extends keyof AgentForm>(k: K, v: AgentForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setK<K extends keyof AgentForm["knowledge"]>(k: K, v: AgentForm["knowledge"][K]) {
    setForm((f) => ({ ...f, knowledge: { ...f.knowledge, [k]: v } }));
  }
  function setSource(k: keyof AgentSources, v: boolean) {
    setForm((f) => ({ ...f, sources: { ...f.sources, [k]: v } }));
  }
  function setOrderFlow<K extends keyof OrderFlowConfig>(k: K, v: OrderFlowConfig[K]) {
    setForm((f) => ({ ...f, order_flow: { ...f.order_flow, [k]: v } }));
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
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">AI Sales Agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your store's chat assistant. It only answers from your real store data.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="ordering">Ordering</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeTab form={form} setSource={setSource} setK={setK} summary={summary} />
        </TabsContent>
        <TabsContent value="behavior" className="mt-4">
          <BehaviorTab form={form} set={set} />
        </TabsContent>
        <TabsContent value="ordering" className="mt-4">
          <OrderingTab form={form} setOrderFlow={setOrderFlow} paymentMethods={paymentMethods} />
        </TabsContent>
      </Tabs>

      <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
