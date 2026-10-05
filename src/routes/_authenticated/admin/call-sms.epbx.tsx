import { createFileRoute, Link } from "@tanstack/react-router";
import { CALL_SMS_PROVIDERS } from "@/lib/call-sms-providers";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Clock, Bot, Sparkles, Lock,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getStoreAiCallSetup, activateStoreAiCallCenter, setStoreAiCallActive, updateStoreAiCallPrefs,
  storeAiCallOverview, listStoreAiCalls, getStoreAiCall,
} from "@/lib/ai-call-center-store.functions";
import { AI_RESULT_LABEL, AI_RESULT_TONE, AI_STATUS_LABEL, AI_STATUS_TONE, formatMinutes } from "@/lib/ai-call-center";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { CallCenterPage } from "@/components/admin/calls/ManualCallCenter";
import { CallAnalyticsCards, CallLogTable } from "@/components/admin/calls/CallAnalytics";
import { listCallRecordings } from "@/lib/call-center.functions";
import {
  ProviderOverviewCard, PhoneNumbersPanel, AgentsPanel, DialPad, ProviderCallLog, AutomatedOrderCalls, WebRtcPanel, NotAvailable, AccountHubCard, LowBalanceBanner,
} from "@/components/admin/calls/EpbxPanels";
import { EpbxEndpointsCard, EpbxTestCallCard } from "@/components/admin/calls/EpbxIntegrationCards";
import { VoiceProviderPanel, VoiceSettingsPanel, ProviderManagedNote, useVoiceConnection } from "@/components/admin/calls/VoicePanels";

import { Stat } from "@/components/admin/calls/AiVoiceAgentPanel";

export const Route = createFileRoute("/_authenticated/admin/call-sms/epbx")({
  component: CallCenterHub,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({
    meta: [
      { title: "ePBX — AI Call & SMS Integration — ORZEN Merchant Panel" },
      { name: "description", content: "Your ePBX calling connection: order confirmation calls, call history, recordings & extensions." },
      { property: "og:title", content: "ePBX — AI Call & SMS Integration — ORZEN Merchant Panel" },
      { property: "og:description", content: "Your ePBX calling connection: order confirmation calls, call history, recordings & extensions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const HUB_TABS = CALL_SMS_PROVIDERS.find((p) => p.id === "epbx")!.sections;
const LEGACY_TABS: Record<string, string> = { provider: "integration", agents: "extensions" };

function CallCenterHub() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const wanted = LEGACY_TABS[search.tab ?? ""] ?? search.tab;
  const tab = HUB_TABS.find((t) => t.key === wanted)?.key ?? "overview";
  const conn = useVoiceConnection();
  const c: any = conn.data?.connection;
  const connected = c?.status === "connected";
  const needProvider = <ProviderManagedNote text={connected ? "This is controlled by your connected provider and will appear here when ePBX makes it available." : "Connect ePBX in the Integration section to see this."} />;

  return (
    <FeatureGate feature="call_center">
      <div className="space-y-4">
        <AdminPageHeader title="ePBX" description="AI Call & SMS Integration → ePBX: order confirmation calls, customer calls, history & your ePBX connection." />
        {connected && <LowBalanceBanner />}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {HUB_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => navigate({ search: { tab: t.key } })}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${tab === t.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-3">
            {connected && <AccountHubCard />}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={PhoneCall} label="Provider" value="ePBX" />
              <Stat icon={connected ? CheckCircle2 : XCircle} label="Status" value={connected ? "Connected" : "Not connected"} tone={connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
              <Stat icon={Clock} label="Balance" value={c?.account_info?.balance != null ? `৳${c.account_info.balance}` : "—"} />
              <Stat icon={PhoneOutgoing} label="Default Caller ID" value={c?.default_caller_id || "—"} />
            </div>
            <CallAnalyticsCards />
            {connected && <ProviderOverviewCard />}
            {connected && <AutomatedOrderCalls />}
          </div>
        )}
        {tab === "calls" && (
          <div className="min-w-0 space-y-4">
            {connected && <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"><DialPad /><CallLogTable /></div>}
            {!connected && <CallLogTable />}
            <CallCenterPage />
            {connected && <ProviderCallLog />}
          </div>
        )}
        {tab === "recordings" && (connected ? <div className="space-y-4"><RecordingsPanel /><ProviderCallLog recordingsOnly /></div> : needProvider)}
        {tab === "extensions" && (connected ? <AgentsPanel /> : needProvider)}
        {tab === "numbers" && (connected ? <PhoneNumbersPanel /> : needProvider)}
        {tab === "integration" && (
          <div className="space-y-4">
            <VoiceProviderPanel />
            {connected && <EpbxTestCallCard />}
            <EpbxEndpointsCard />
            {connected && <ProviderOverviewCard />}
            {connected && <WebRtcPanel />}
          </div>
        )}
        {tab === "settings" && <VoiceSettingsPanel />}
        {tab === "automation" && (connected ? <AutomatedOrderCalls /> : needProvider)}
        {tab === "ivr" && <NotAvailable title="IVR" text="IVR menus, DTMF routes & destinations: Not available through the current ePBX API access. Order calls use ePBX's built-in verification IVR (1 = confirm, 2 = cancel)." />}
      </div>
    </FeatureGate>
  );
}

function RecordingsPanel() {
  const fn = useServerFn(listCallRecordings);
  const q = useQuery({ queryKey: ["voice", "recordings"], queryFn: () => fn() });
  const rows = q.data ?? [];
  if (q.isLoading) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.customer_name || r.phone}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {Math.floor((r.duration_sec ?? 0) / 60)}m {(r.duration_sec ?? 0) % 60}s</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {r.result === "order_confirmed" ? "Order confirmed (pressed 1)" : r.result === "order_cancelled" ? "Order cancelled (pressed 2)" : r.status}
          </div>
          <audio controls preload="none" className="mt-2 w-full" src={r.play_url} />
        </div>
      ))}
    </div>
  );
}
