import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { OverviewTab } from "@/components/owner/ai-calls/OverviewTab";
import { ProvidersTab } from "@/components/owner/ai-calls/ProvidersTab";
import { NumbersTab } from "@/components/owner/ai-calls/NumbersTab";
import { AgentsTab } from "@/components/owner/ai-calls/AgentsTab";
import { VoicesTab } from "@/components/owner/ai-calls/VoicesTab";
import { BehaviorTab } from "@/components/owner/ai-calls/BehaviorTab";
import { StoresTab } from "@/components/owner/ai-calls/StoresTab";

export const Route = createFileRoute("/_authenticated/owner/ai-call-center")({
  component: OwnerAiCallCenter,
  head: () => ({
    meta: [
      { title: "AI Call Center | Platform Admin" },
      { name: "description", content: "Configure ElevenLabs voice agents, Twilio numbers, call behavior and per-store access for AI phone calls." },
    ],
  }),
});

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "providers", label: "Providers" },
  { key: "numbers", label: "Phone Numbers" },
  { key: "agents", label: "AI Agents" },
  { key: "voices", label: "Voices & Tones" },
  { key: "behavior", label: "Behavior & Rules" },
  { key: "stores", label: "Stores" },
] as const;

function OwnerAiCallCenter() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");

  return (
    <div>
      <OwnerPageHeader
        title="AI Call Center"
        description="Voice agents, phone numbers and calling rules for every store on the platform."
      />

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${tab === t.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "providers" && <ProvidersTab />}
      {tab === "numbers" && <NumbersTab />}
      {tab === "agents" && <AgentsTab />}
      {tab === "voices" && <VoicesTab />}
      {tab === "behavior" && <BehaviorTab />}
      {tab === "stores" && <StoresTab />}
    </div>
  );
}
