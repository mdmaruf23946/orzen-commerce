import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { AiVoiceAgentPanel } from "@/components/admin/calls/AiVoiceAgentPanel";

export const Route = createFileRoute("/_authenticated/admin/call-sms/ai-voice-agent")({
  component: Page,
  head: () => ({
    meta: [
      { title: "AI Voice Agent — Call & SMS Apps — ORZEN" },
      { name: "description", content: "Let an AI voice agent confirm orders by phone and answer customer calls." },
      { property: "og:title", content: "AI Voice Agent — Call & SMS Apps — ORZEN" },
      { property: "og:description", content: "Let an AI voice agent confirm orders by phone and answer customer calls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <FeatureGate feature="call_center">
      <div className="space-y-4">
        <AdminPageHeader title="AI Voice Agent" description="Platform AI voice agent for order calls. Separate from your Call & SMS providers." />
        <AiVoiceAgentPanel />
      </div>
    </FeatureGate>
  );
}
