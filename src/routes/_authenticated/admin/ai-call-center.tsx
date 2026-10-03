import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Clock, Bot, Sparkles, Lock,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { ComingSoon } from "@/components/owner/ComingSoon";
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
import { VoiceProviderPanel, VoiceSettingsPanel, ProviderManagedNote, useVoiceConnection } from "@/components/admin/calls/VoicePanels";

export const Route = createFileRoute("/_authenticated/admin/ai-call-center")({
  component: CallCenterHub,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({
    meta: [
      { title: "AI Call Center — ORZEN Merchant Panel" },
      { name: "description", content: "Let an AI voice agent confirm your orders by phone and answer customer calls around the clock." },
      { property: "og:title", content: "AI Call Center — ORZEN Merchant Panel" },
      { property: "og:description", content: "Let an AI voice agent confirm your orders by phone and answer customer calls around the clock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AiVoiceAgentPanel() {
  const qc = useQueryClient();
  const setupFn = useServerFn(getStoreAiCallSetup);
  const overviewFn = useServerFn(storeAiCallOverview);
  const listFn = useServerFn(listStoreAiCalls);
  const activeFn = useServerFn(setStoreAiCallActive);
  const prefsFn = useServerFn(updateStoreAiCallPrefs);

  const setup = useQuery({ queryKey: ["store-ai-call", "setup"], queryFn: () => setupFn() });
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [search, setSearch] = useState("");

  const s: any = setup.data;
  const live = !!s?.is_active;

  const overview = useQuery({
    queryKey: ["store-ai-call", "overview"],
    queryFn: () => overviewFn(),
    enabled: live,
  });
  const calls = useQuery({
    queryKey: ["store-ai-call", "calls", direction, search],
    queryFn: () => listFn({ data: { direction, search, limit: 30 } }),
    enabled: live,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["store-ai-call"] });
  }

  const AI_CALL_CENTER_ENABLED = false;

  if (!AI_CALL_CENTER_ENABLED) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="AI Call Center" description="AI voice agents that confirm orders and answer customer calls." />
        <ComingSoon
          title="AI Call Center is coming soon"
          description="We're building AI voice agents that can confirm orders and answer customer calls around the clock. Setup options, phone numbers, voice selection and call controls will appear here automatically once the feature is live."
        />
      </div>
    );
  }

  if (setup.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!s?.feature_enabled) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="AI Call Center" description="AI voice agents that confirm orders and answer customer calls." />
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">AI Call Center is not included in your plan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Upgrade your subscription to unlock AI voice calling. After upgrading you can pick a phone number, a voice
            and a tone, and your AI agent starts calling customers to confirm orders.
          </p>
          <Button asChild className="mt-4">
            <Link to="/admin/billing" search={{ highlight: "ai_call_center" } as any}>
              Update
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="AI Call Center"
        description="Your AI voice agent confirms orders and answers customer calls."
        action={
          s.selection?.activated_at ? (
            <label className="flex items-center gap-2 text-xs">
              {live ? "Live" : "Paused"}
              <Switch
                checked={live}
                onCheckedChange={async (v) => {
                  await activeFn({ data: { active: v } });
                  await refresh();
                  toast.success(v ? "AI calling resumed" : "AI calling paused");
                }}
              />
            </label>
          ) : undefined
        }
      />

      {!s.selection?.activated_at ? (
        <SetupWizard setup={s} onDone={refresh} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat icon={PhoneCall} label="Calls Today" value={overview.data?.today ?? 0} />
            <Stat icon={PhoneOutgoing} label="Outbound" value={overview.data?.outbound ?? 0} />
            <Stat icon={PhoneIncoming} label="Inbound" value={overview.data?.inbound ?? 0} />
            <Stat icon={CheckCircle2} label="Confirmed" value={overview.data?.confirmed ?? 0} tone="text-emerald-600 dark:text-emerald-400" />
            <Stat icon={XCircle} label="Cancelled" value={overview.data?.cancelled ?? 0} tone="text-destructive" />
            <Stat icon={Clock} label="Minutes" value={overview.data?.minutes ?? 0} />
          </div>

          <section className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-3">
            <Pref
              label="Answer incoming calls"
              checked={!!s.selection.inbound_enabled}
              onChange={async (v) => { await prefsFn({ data: { inbound_enabled: v } }); await refresh(); }}
            />
            <Pref
              label="Call customers for order confirmation"
              checked={!!s.selection.outbound_enabled}
              onChange={async (v) => { await prefsFn({ data: { outbound_enabled: v } }); await refresh(); }}
            />
            <Pref
              label="Update the order automatically after the call"
              checked={!!s.selection.auto_confirm_orders}
              onChange={async (v) => { await prefsFn({ data: { auto_confirm_orders: v } }); await refresh(); }}
            />
          </section>

          <div className="rounded-2xl border bg-card">
            <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1.5">
                {(["all", "outbound", "inbound"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium capitalize ${direction === d ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <Input className="h-9 sm:w-64" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" />
            </div>
            {!calls.data?.length ? (
              <div className="p-6 text-sm text-muted-foreground">No AI calls yet.</div>
            ) : (
              <div className="divide-y">
                {(calls.data as any[]).map((c) => <CallRow key={c.id} call={c} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Pref({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => Promise<void> }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs">
      {label}
      <Switch checked={checked} onCheckedChange={(v) => void onChange(v)} />
    </label>
  );
}

function Stat({ icon: Icon, label, value, tone = "" }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function CallRow({ call }: { call: any }) {
  const [open, setOpen] = useState(false);
  const detailFn = useServerFn(getStoreAiCall);
  const detail = useQuery({
    queryKey: ["store-ai-call", "detail", call.id],
    queryFn: () => detailFn({ data: { callId: call.id } }),
    enabled: open,
  });

  return (
    <div className="p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{call.customer_name ?? call.phone}</div>
          <div className="text-xs text-muted-foreground">
            {call.phone} · {call.orders?.invoice_no ?? "No order"} ·{" "}
            {new Date(call.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-xs">{formatMinutes(call.duration_sec ?? 0)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${AI_STATUS_TONE[call.status as keyof typeof AI_STATUS_TONE] ?? ""}`}>
            {AI_STATUS_LABEL[call.status as keyof typeof AI_STATUS_LABEL] ?? call.status}
          </span>
          {call.result && (
            <span className={`hidden rounded-full border px-2 py-0.5 text-[11px] sm:inline ${AI_RESULT_TONE[call.result as keyof typeof AI_RESULT_TONE] ?? ""}`}>
              {AI_RESULT_LABEL[call.result as keyof typeof AI_RESULT_LABEL] ?? call.result}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 rounded-xl border bg-muted/30 p-3">
          {detail.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading transcript…</p>
          ) : (
            <>
              {(detail.data as any)?.call?.summary && (
                <p className="mb-2 text-xs"><span className="font-medium">Summary: </span>{(detail.data as any).call.summary}</p>
              )}
              {(detail.data as any)?.call?.recording_url && (
                <audio controls className="mb-2 w-full" src={(detail.data as any).call.recording_url} />
              )}
              <div className="space-y-1.5">
                {((detail.data as any)?.transcript ?? []).map((t: any, i: number) => (
                  <div key={i} className="text-xs">
                    <span className={t.role === "agent" ? "font-medium text-primary" : "font-medium"}>
                      {t.role === "agent" ? "AI" : "Customer"}:
                    </span>{" "}
                    {t.message}
                  </div>
                ))}
                {!((detail.data as any)?.transcript ?? []).length && (
                  <p className="text-xs text-muted-foreground">No transcript for this call.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- wizard --------------------------------- */

function SetupWizard({ setup, onDone }: { setup: any; onDone: () => Promise<void> }) {
  const activate = useServerFn(activateStoreAiCallCenter);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    phone_number_id: setup.numbers?.[0]?.id ?? "",
    gender: "female" as "female" | "male",
    voice_id: "",
    tone_id: setup.tones?.[0]?.id ?? "",
    auto_confirm_orders: true,
  });

  const voices = (setup.voices ?? []).filter((v: any) => !form.gender || v.gender === form.gender);
  const steps = ["Phone Number", "Voice Gender", "Voice", "Tone", "Confirm"];

  async function finish() {
    setBusy(true);
    try {
      const res: any = await activate({ data: form });
      if (res?.ok) {
        toast.success("Your AI Call Center is live");
        await onDone();
      } else {
        toast.error(res?.error ?? "Could not activate AI calling");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not activate AI calling");
    } finally {
      setBusy(false);
    }
  }

  const canNext =
    (step === 0 && !!form.phone_number_id) ||
    step === 1 ||
    (step === 2 && !!form.voice_id) ||
    (step === 3 && !!form.tone_id) ||
    step === 4;

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Set up your AI phone agent</h2>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((label, i) => (
          <span
            key={label}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${i === step ? "border-primary bg-primary/10 text-primary" : i < step ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {step === 0 && (
          !setup.numbers?.length ? (
            <p className="text-sm text-muted-foreground">
              No phone number is assigned to your store yet. The platform team will assign one shortly.
            </p>
          ) : (
            setup.numbers.map((n: any) => (
              <Choice
                key={n.id}
                selected={form.phone_number_id === n.id}
                onClick={() => setForm({ ...form, phone_number_id: n.id })}
                title={n.phone_number}
                subtitle={`${n.country} · ${n.inbound_enabled ? "Inbound" : ""}${n.inbound_enabled && n.outbound_enabled ? " & " : ""}${n.outbound_enabled ? "Outbound" : ""}`}
              />
            ))
          )
        )}

        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["female", "male"] as const).map((g) => (
              <Choice
                key={g}
                selected={form.gender === g}
                onClick={() => setForm({ ...form, gender: g, voice_id: "" })}
                title={g === "female" ? "Female voice" : "Male voice"}
                subtitle="Choose how your agent should sound"
              />
            ))}
          </div>
        )}

        {step === 2 && (
          !voices.length ? (
            <p className="text-sm text-muted-foreground">No voices available for this selection yet.</p>
          ) : (
            voices.map((v: any) => (
              <Choice
                key={v.id}
                selected={form.voice_id === v.id}
                onClick={() => setForm({ ...form, voice_id: v.id })}
                title={v.name}
                subtitle={[v.accent, v.language, v.description].filter(Boolean).join(" · ")}
                aside={v.preview_url ? <audio controls src={v.preview_url} className="h-8" /> : null}
              />
            ))
          )
        )}

        {step === 3 && (
          (setup.tones ?? []).map((t: any) => (
            <Choice
              key={t.id}
              selected={form.tone_id === t.id}
              onClick={() => setForm({ ...form, tone_id: t.id })}
              title={t.name}
              subtitle={t.description}
            />
          ))
        )}

        {step === 4 && (
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Ready to go live</div>
            <p className="text-xs text-muted-foreground">
              Your AI agent will call customers after they place an order and confirm the details, and it will answer
              calls to your number. You can pause it any time.
            </p>
            <label className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
              Update the order automatically based on the call outcome
              <Switch checked={form.auto_confirm_orders} onCheckedChange={(v) => setForm({ ...form, auto_confirm_orders: v })} />
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < 4 ? (
          <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <Button size="sm" disabled={busy || !form.phone_number_id || !form.voice_id || !form.tone_id} onClick={() => void finish()}>
            {busy ? "Activating…" : "Activate AI Calling"}
          </Button>
        )}
      </div>

      {setup.selection?.last_error && (
        <p className="mt-2 text-[11px] text-muted-foreground">Last attempt did not complete. Please try again.</p>
      )}
    </section>
  );
}

function Choice({
  selected, onClick, title, subtitle, aside,
}: { selected: boolean; onClick: () => void; title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {aside}
    </div>
  );
}

const HUB_TABS = [
  { key: "overview", label: "Overview" },
  { key: "calls", label: "Calls & History" },
  { key: "recordings", label: "Recordings" },
  { key: "agents", label: "Agents" },
  { key: "numbers", label: "Phone Numbers" },
  { key: "provider", label: "Provider" },
  { key: "settings", label: "Settings" },
  { key: "ai", label: "AI Voice Agent" },
] as const;

function CallCenterHub() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = (HUB_TABS.find((t) => t.key === search.tab)?.key ?? "overview") as (typeof HUB_TABS)[number]["key"];
  const conn = useVoiceConnection();
  const c: any = conn.data?.connection;
  const connected = c?.status === "connected";
  const needProvider = <ProviderManagedNote text={connected ? "This is controlled by your connected provider and will appear here when ePBX makes it available." : "Connect a calling provider in the Provider tab to see this."} />;

  return (
    <FeatureGate feature="call_center">
      <div className="space-y-4">
        <AdminPageHeader title="AI Call Center" description="Order confirmation calls, customer calls, history and your ePBX connection." />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {HUB_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => navigate({ search: { tab: t.key } })}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${tab === t.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon={PhoneCall} label="Provider" value="ePBX" />
            <Stat icon={connected ? CheckCircle2 : XCircle} label="Status" value={connected ? "Connected" : "Not connected"} tone={connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
            <Stat icon={Clock} label="Balance" value={c?.account_info?.balance != null ? `৳${c.account_info.balance}` : "—"} />
            <Stat icon={PhoneOutgoing} label="Default Caller ID" value={c?.default_caller_id || "—"} />
          </div>
        )}
        {tab === "calls" && <CallCenterPage />}
        {tab === "recordings" && needProvider}
        {tab === "agents" && <ProviderManagedNote text="Agent management is controlled by the connected provider." />}
        {tab === "numbers" && needProvider}
        {tab === "provider" && <VoiceProviderPanel />}
        {tab === "settings" && <VoiceSettingsPanel />}
        {tab === "ai" && <AiVoiceAgentPanel />}
      </div>
    </FeatureGate>
  );
}
