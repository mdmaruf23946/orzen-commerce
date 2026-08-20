import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle, Loader2, Copy, RefreshCw, Plug, PlugZap, Send, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  getWhatsappIntegration, connectWhatsapp, disconnectWhatsapp, testWhatsappConnection,
  sendWhatsappTestMessage, regenerateWhatsappVerifyToken, updateWhatsappAiFlags,
  clearWhatsappLastError, listWhatsappTemplates, syncWhatsappTemplates,
  listWhatsappWebhookEvents, getWhatsappAnalytics,
} from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  component: WhatsappPage,
  head: () => ({
    meta: [
      { title: "WhatsApp Integration | ORZEN Store Admin" },
      { name: "description", content: "Connect WhatsApp Cloud API to your store and let the AI sales agent reply to customers automatically." },
      { property: "og:title", content: "WhatsApp Integration | ORZEN Store Admin" },
      { property: "og:description", content: "Connect WhatsApp Cloud API and manage AI auto-replies for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const AI_FLAGS: { key: string; label: string; hint: string }[] = [
  { key: "ai_auto_reply", label: "AI auto reply", hint: "Let the AI sales agent answer incoming WhatsApp messages" },
  { key: "conversation_history", label: "Conversation memory", hint: "Send earlier messages as context to the AI" },
  { key: "order_detection", label: "Order detection", hint: "Collect order details in chat for physical products" },
  { key: "product_recommendation", label: "Product recommendations", hint: "Suggest related products from your catalogue" },
  { key: "faq_reply", label: "FAQ answers", hint: "Answer delivery, payment and return questions" },
];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "bg-whatsapp/10 text-whatsapp-deep border-whatsapp/30 dark:text-whatsapp",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    connecting: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function WhatsappPage() {
  const qc = useQueryClient();
  const load = useServerFn(getWhatsappIntegration);
  const connect = useServerFn(connectWhatsapp);
  const disconnect = useServerFn(disconnectWhatsapp);
  const test = useServerFn(testWhatsappConnection);
  const sendTest = useServerFn(sendWhatsappTestMessage);
  const regen = useServerFn(regenerateWhatsappVerifyToken);
  const saveFlags = useServerFn(updateWhatsappAiFlags);
  const clearErr = useServerFn(clearWhatsappLastError);
  const loadTemplates = useServerFn(listWhatsappTemplates);
  const syncTemplates = useServerFn(syncWhatsappTemplates);
  const loadEvents = useServerFn(listWhatsappWebhookEvents);
  const loadStats = useServerFn(getWhatsappAnalytics);

  const { data, isLoading } = useQuery({ queryKey: ["admin", "whatsapp"], queryFn: () => load() });
  const { data: templates } = useQuery({ queryKey: ["admin", "whatsapp", "templates"], queryFn: () => loadTemplates() });
  const { data: events } = useQuery({ queryKey: ["admin", "whatsapp", "events"], queryFn: () => loadEvents() });
  const { data: stats } = useQuery({ queryKey: ["admin", "whatsapp", "stats"], queryFn: () => loadStats() });

  const [form, setForm] = useState({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        phone_number_id: (data as any).phone_number_id ?? "",
        waba_id: (data as any).waba_id ?? "",
      }));
    }
  }, [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
  };

  async function run(key: string, fn: () => Promise<any>, okMsg?: string) {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const d = data as any;

  return (
    <div className="max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-whatsapp/20 bg-whatsapp/5 p-3">
        <WhatsAppMark size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">WhatsApp Integration</h1>
          <p className="text-sm text-muted-foreground">
            Connect WhatsApp Cloud API so your AI sales agent can chat with customers.
          </p>
        </div>
        <StatusPill status={d.status ?? "not_connected"} />
      </header>

      {d.last_error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{d.last_error}</span>
          <Button size="sm" variant="ghost" onClick={() => run("clear", () => clearErr(), "Cleared")}>
            Dismiss
          </Button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Conversations", value: (stats as any).total_conversations },
            { label: "AI handled", value: (stats as any).ai_handled },
            { label: "Human handled", value: (stats as any).human_handled },
            { label: "Orders", value: (stats as any).orders ?? (stats as any).conversions },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-semibold">{s.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Connection */}
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Cloud API credentials</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Phone Number ID</Label>
            <Input
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              placeholder="1234567890"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp Business Account ID</Label>
            <Input
              value={form.waba_id}
              onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
              placeholder="Required for template sync"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Permanent access token</Label>
            <Input
              type="password"
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              placeholder={d.has_token ? "•••••••• (saved)" : "EAAG…"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">App secret</Label>
            <Input
              type="password"
              value={form.app_secret}
              onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              placeholder={d.has_app_secret ? "•••••••• (saved)" : "Used to verify webhooks"}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy === "connect" || !form.phone_number_id}
            onClick={() =>
              run(
                "connect",
                () =>
                  connect({
                    data: {
                      phone_number_id: form.phone_number_id.trim(),
                      waba_id: form.waba_id.trim() || null,
                      access_token: form.access_token.trim() || null,
                      app_secret: form.app_secret.trim() || null,
                    },
                  }),
                "WhatsApp connected",
              )
            }
          >
            {busy === "connect" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
            {d.connected ? "Update connection" : "Connect"}
          </Button>
          {d.connected && (
            <>
              <Button size="sm" variant="outline" disabled={busy === "test"} onClick={() => run("test", () => test(), "Connection is healthy")}>
                {busy === "test" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Test connection
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy === "disconnect"}
                onClick={() => run("disconnect", () => disconnect(), "Disconnected")}
              >
                <PlugZap className="mr-1 h-4 w-4" /> Disconnect
              </Button>
            </>
          )}
        </div>
        {d.phone_number && (
          <p className="text-xs text-muted-foreground">
            {d.display_name ? `${d.display_name} · ` : ""}
            {d.phone_number}
            {d.quality_rating ? ` · quality ${d.quality_rating}` : ""}
          </p>
        )}
      </section>

      {/* Webhook */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Webhook</h2>
        <p className="text-xs text-muted-foreground">
          Paste these into Meta → WhatsApp → Configuration, and subscribe to the <code>messages</code> field.
        </p>
        <CopyField label="Callback URL" value={d.webhook_url} />
        <CopyField label="Verify token" value={d.verify_token ?? ""} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy === "regen"} onClick={() => run("regen", () => regen(), "New verify token generated")}>
            <RefreshCw className="mr-1 h-4 w-4" /> Regenerate token
          </Button>
          <span className="text-xs text-muted-foreground">
            {d.webhook?.last_at ? `Last event ${new Date(d.webhook.last_at).toLocaleString()} (${d.webhook.last_type})` : "No webhook events yet"}
          </span>
        </div>
        {!!(events as any[])?.length && (
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-2 text-[11px]">
            {(events as any[]).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="truncate">{e.event_type}</span>
                <span className="shrink-0 text-muted-foreground">{new Date(e.received_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AI behaviour */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">AI behaviour</h2>
        {AI_FLAGS.map((f) => (
          <label key={f.key} className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
            <span>
              <span className="block text-sm">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
            <Switch
              checked={d[f.key] !== false}
              onCheckedChange={(v) => run(f.key, () => saveFlags({ data: { [f.key]: v } }), "Saved")}
            />
          </label>
        ))}
        <label className="flex items-start justify-between gap-3 pt-1">
          <span>
            <span className="block text-sm">Human takeover</span>
            <span className="block text-xs text-muted-foreground">Pause the AI on every conversation and reply manually</span>
          </span>
          <Switch
            checked={!!d.human_takeover}
            onCheckedChange={(v) => run("human_takeover", () => saveFlags({ data: { human_takeover: v } }), "Saved")}
          />
        </label>
      </section>

      {/* Test message */}
      {d.connected && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Send a test message</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="8801XXXXXXXXX"
            />
            <Button
              size="sm"
              disabled={busy === "sendtest" || testTo.trim().length < 6}
              onClick={() => run("sendtest", () => sendTest({ data: { to: testTo.trim() } }), "Test message sent")}
            >
              {busy === "sendtest" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The recipient must have messaged your number in the last 24 hours, otherwise use an approved template.
          </p>
        </section>
      )}

      {/* Templates */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold">Message templates</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={busy === "sync"}
            onClick={() =>
              run("sync", async () => {
                await syncTemplates();
                qc.invalidateQueries({ queryKey: ["admin", "whatsapp", "templates"] });
              }, "Templates synced")
            }
          >
            {busy === "sync" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Sync from Meta
          </Button>
        </div>
        {!(templates as any[])?.length ? (
          <p className="text-xs text-muted-foreground">No templates yet. Sync after your templates are approved in Meta.</p>
        ) : (
          <ul className="divide-y text-sm">
            {(templates as any[]).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.language}</span>
                <span className="ml-auto text-[11px] uppercase text-muted-foreground">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
