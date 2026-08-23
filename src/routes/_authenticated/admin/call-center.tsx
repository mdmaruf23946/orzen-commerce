import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, PhoneCall, PhoneMissed, PhoneOff, Clock, Search, Trash2, Plug, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CallButton } from "@/components/admin/calls/CallButton";
import { CallResultBadge, CallStatusBadge } from "@/components/admin/calls/CallStatusBadge";
import {
  getCallProvider, saveCallProvider, testCallProvider, disconnectCallProvider,
  getCallCenterOverview, listCalls, deleteCall,
} from "@/lib/call-center.functions";
import {
  formatDuration, LIVE_STATUSES, PROVIDER_LABEL, PROVIDER_STATE_LABEL,
  type CallProvider, type CallRow,
} from "@/lib/call-center";

export const Route = createFileRoute("/_authenticated/admin/call-center")({
  component: () => (
    <FeatureGate feature="call_center">
      <CallCenterPage />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Manual Call Center | Store Admin" },
      { name: "description", content: "Call customers in one click, track call status and log call results next to your orders." },
    ],
  }),
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "answered", label: "Answered" },
  { key: "missed", label: "Missed" },
  { key: "failed", label: "Failed" },
  { key: "no_answer", label: "No Answer" },
] as const;

function CallCenterPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");

  const overviewFn = useServerFn(getCallCenterOverview);
  const listFn = useServerFn(listCalls);

  const overview = useQuery({
    queryKey: ["call-center", "overview"],
    queryFn: () => overviewFn(),
  });

  const calls = useQuery({
    queryKey: ["calls", filter, search],
    queryFn: () => listFn({ data: { filter, search, limit: 50 } }),
    refetchInterval: (q) => {
      const rows = (q.state.data ?? []) as CallRow[];
      return rows.some((r) => LIVE_STATUSES.includes(r.status)) ? 5000 : false;
    },
  });

  const stats = overview.data;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Manual Call Center"
        description="Call customers in one click and log the result against the order."
      />

      <ProviderCard />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={PhoneCall} label="Calls Today" value={stats?.total ?? 0} />
        <Stat icon={Phone} label="Answered" value={stats?.answered ?? 0} tone="text-emerald-600" />
        <Stat icon={PhoneMissed} label="Missed" value={stats?.missed ?? 0} tone="text-amber-600" />
        <Stat icon={PhoneOff} label="Busy" value={stats?.busy ?? 0} tone="text-violet-600" />
        <Stat icon={PhoneOff} label="Failed" value={stats?.failed ?? 0} tone="text-destructive" />
        <Stat icon={Clock} label="Total Duration" value={formatDuration(stats?.duration_sec ?? 0)} />
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${filter === f.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone or order"
              className="h-9 pl-8"
            />
          </div>
        </div>

        {calls.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading calls…</div>
        ) : !calls.data?.length ? (
          <div className="p-6 text-sm text-muted-foreground">No calls found.</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y lg:hidden">
              {calls.data.map((c) => <CallCardRow key={c.id} call={c} />)}
            </div>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Date &amp; Time</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calls.data.map((c) => <CallTableRow key={c.id} call={c} />)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tone = "",
}: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function useDelete() {
  const del = useServerFn(deleteCall);
  const qc = useQueryClient();
  return async (id: string) => {
    await del({ data: { callId: id } });
    await qc.invalidateQueries({ queryKey: ["calls"] });
    await qc.invalidateQueries({ queryKey: ["call-center"] });
    toast.success("Call removed");
  };
}

function CallTableRow({ call }: { call: CallRow }) {
  const remove = useDelete();
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2">
        <div className="font-medium">{call.customer_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{call.phone}</div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {call.order_id ? (
          <Link to="/admin/orders" className="text-primary hover:underline">
            {call.invoice_no ?? `#${call.order_id.slice(0, 8).toUpperCase()}`}
          </Link>
        ) : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {new Date(call.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{formatDuration(call.duration_sec)}</td>
      <td className="px-3 py-2"><CallStatusBadge status={call.status} /></td>
      <td className="px-3 py-2"><CallResultBadge result={call.result} /></td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{call.agent_email ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          <CallButton
            phone={call.phone}
            customerName={call.customer_name}
            orderId={call.order_id}
            customerId={call.customer_id}
            variant="outline"
            label="Call Again"
          />
          <button
            type="button"
            onClick={() => void remove(call.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Delete call"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CallCardRow({ call }: { call: CallRow }) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{call.customer_name ?? call.phone}</div>
          <div className="text-xs text-muted-foreground">{call.phone}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {new Date(call.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {" · "}
            <span className="font-mono">{formatDuration(call.duration_sec)}</span>
          </div>
        </div>
        <CallStatusBadge status={call.status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <CallResultBadge result={call.result} />
          {call.invoice_no && <span className="font-mono text-[11px] text-muted-foreground">{call.invoice_no}</span>}
        </div>
        <CallButton
          phone={call.phone}
          customerName={call.customer_name}
          orderId={call.order_id}
          customerId={call.customer_id}
          variant="outline"
          label="Call Again"
        />
      </div>
      {call.note && <div className="text-xs text-muted-foreground">{call.note}</div>}
    </div>
  );
}

/* ------------------------------ provider UI ----------------------------- */

function ProviderCard() {
  const getFn = useServerFn(getCallProvider);
  const saveFn = useServerFn(saveCallProvider);
  const testFn = useServerFn(testCallProvider);
  const disconnectFn = useServerFn(disconnectCallProvider);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["call-center", "provider"], queryFn: () => getFn() });

  const [draft, setDraft] = useState<{
    provider: CallProvider; caller_id: string; agent_phone: string; account_sid: string; auth_token: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useMemo(
    () =>
      draft ?? {
        provider: (data?.provider ?? "device") as CallProvider,
        caller_id: data?.caller_id ?? "",
        agent_phone: "",
        account_sid: "",
        auth_token: "",
      },
    [draft, data],
  );

  const state = data?.status ?? "not_connected";
  const tone =
    state === "connected"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : state === "error"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["call-center", "provider"] });
  }

  async function save() {
    setBusy(true);
    try {
      await saveFn({ data: form });
      setDraft(null);
      await refresh();
      toast.success("Calling provider saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the calling provider.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res: any = await testFn();
      await refresh();
      if (res.ok) toast.success("Connection is working");
      else toast.error(res.error ?? "Connection failed");
    } catch {
      toast.error("Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectFn();
      setDraft(null);
      await refresh();
      toast.success("Calling provider disconnected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Calling Provider</h2>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>
            {PROVIDER_STATE_LABEL[state]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void test()} disabled={busy || isLoading}>
            Test Connection
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void disconnect()} disabled={busy || isLoading}>
            Disconnect
          </Button>
        </div>
      </div>

      {data?.last_error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{data.last_error}</p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-xs">Provider</Label>
          <Select
            value={form.provider}
            onValueChange={(v) => setDraft({ ...form, provider: v as CallProvider })}
          >
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABEL) as CallProvider[]).map((p) => (
                <SelectItem key={p} value={p}>{PROVIDER_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Caller ID / Business Number</Label>
          <Input
            className="mt-1 h-9"
            value={form.caller_id}
            onChange={(e) => setDraft({ ...form, caller_id: e.target.value })}
            placeholder="+8801XXXXXXXXX"
          />
        </div>

        <div>
          <Label className="text-xs">Your Phone (rings first)</Label>
          <Input
            className="mt-1 h-9"
            value={form.agent_phone}
            onChange={(e) => setDraft({ ...form, agent_phone: e.target.value })}
            placeholder={data?.has_credentials ? "Saved — leave blank to keep" : "+8801XXXXXXXXX"}
          />
        </div>

        {form.provider === "twilio" && (
          <>
            <div>
              <Label className="text-xs">Account SID</Label>
              <Input
                className="mt-1 h-9"
                value={form.account_sid}
                onChange={(e) => setDraft({ ...form, account_sid: e.target.value })}
                placeholder={data?.has_credentials ? "Saved — leave blank to keep" : "AC…"}
              />
            </div>
            <div>
              <Label className="text-xs">Auth Token</Label>
              <Input
                type="password"
                className="mt-1 h-9"
                value={form.auth_token}
                onChange={(e) => setDraft({ ...form, auth_token: e.target.value })}
                placeholder={data?.has_credentials ? "•••••••• saved" : "Auth token"}
                autoComplete="new-password"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Credentials are encrypted{data?.credentials_preview ? ` (${data.credentials_preview})` : ""} and never shown again.
        </p>
        <Button size="sm" onClick={() => void save()} disabled={busy || isLoading}>
          {busy ? "Saving…" : "Save Provider"}
        </Button>
      </div>
    </section>
  );
}
