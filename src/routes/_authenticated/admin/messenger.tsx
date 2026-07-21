import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  connectMessenger,
  disconnectMessenger,
  getMessengerIntegration,
  verifyMessengerWebhook,
  sendMessengerTestMessage,
  regenerateMessengerVerifyToken,
  refreshMessengerPermissions,
  updateMessengerAiFlags,
  listMessengerRecentPsids,
} from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Eye, EyeOff, RefreshCcw, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/messenger")({
  component: () => (
    <FeatureGate feature="ai_messenger">
      <AdminMessenger />
    </FeatureGate>
  ),
});

type LogEntry = { at: string; text: string; ok: boolean };

function AdminMessenger() {
  const fetchIntegration = useServerFn(getMessengerIntegration);
  const connect = useServerFn(connectMessenger);
  const disconnect = useServerFn(disconnectMessenger);
  const verifyWh = useServerFn(verifyMessengerWebhook);
  const sendTest = useServerFn(sendMessengerTestMessage);
  const regen = useServerFn(regenerateMessengerVerifyToken);
  const refreshPerms = useServerFn(refreshMessengerPermissions);
  const updateFlags = useServerFn(updateMessengerAiFlags);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "messenger"],
    queryFn: () => fetchIntegration(),
  });
  const d: any = data ?? {};
  const connected = !!d.connected;

  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testPsid, setTestPsid] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [diag, setDiag] = useState<any | null>(null);

  useEffect(() => {
    if (!data) return;
    setPageId(d.page_id ?? "");
    setAppId(d.app_id ?? "");
    setPrivacyUrl(d.privacy_policy_url ?? "");
    setTermsUrl(d.terms_of_service_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function isHttpsUrl(v: string) {
    if (!v) return false;
    try {
      const u = new URL(v);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }
  const privacyValid = isHttpsUrl(privacyUrl.trim());
  const termsValid = !termsUrl.trim() || isHttpsUrl(termsUrl.trim());
  const privacySaved = !!d.privacy_policy_url && isHttpsUrl(d.privacy_policy_url);
  const termsSaved = !!d.terms_of_service_url && isHttpsUrl(d.terms_of_service_url);

  function pushLog(text: string, ok = true) {
    setLog((l) => [{ at: new Date().toISOString(), text, ok }, ...l].slice(0, 10));
  }

  async function copy(v: string | null | undefined, label = "Copied") {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success(label);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function onConnect(e?: React.FormEvent) {
    e?.preventDefault();
    if (!pageId.trim() || !token.trim()) {
      toast.error("Page ID and Page Access Token are required");
      return;
    }
    if (!privacyValid) {
      toast.error("A valid HTTPS Privacy Policy URL is required");
      return;
    }
    if (!termsValid) {
      toast.error("Terms of Service URL must be a valid HTTPS URL");
      return;
    }
    setBusy(true);
    try {
      await connect({
        data: {
          page_id: pageId.trim(),
          page_access_token: token.trim(),
          app_id: appId.trim() || null,
          app_secret: appSecret.trim() || null,
          privacy_policy_url: privacyUrl.trim(),
          terms_of_service_url: termsUrl.trim() || null,
        },
      });
      setToken("");
      setAppSecret("");
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      toast.success("Connected");
      pushLog("Connected to Facebook Page", true);
    } catch (err) {
      toast.error((err as Error).message);
      pushLog(`Connect failed: ${(err as Error).message}`, false);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (!confirm("Disconnect Messenger?")) return;
    setBusy(true);
    try {
      await disconnect();
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      toast.success("Disconnected");
      pushLog("Disconnected", true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setBusy(true);
    try {
      const r: any = await verifyWh();
      setDiag(r);
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      if (r?.ok) {
        toast.success("Webhook verified");
        pushLog(`Verified — GET ${r.get_status}, echoed challenge`, true);
      } else {
        const msg = r?.error
          ? `Unreachable: ${r.error}`
          : `GET ${r?.get_status ?? "?"} · body="${(r?.get_body ?? "").slice(0, 40)}"`;
        toast.error("Verification failed");
        pushLog(`Verify failed — ${msg}`, false);
      }
    } catch (err) {
      setDiag({ ok: false, error: (err as Error).message });
      toast.error((err as Error).message);
      pushLog(`Verify error: ${(err as Error).message}`, false);
    } finally {
      setBusy(false);
    }
  }


  async function onRegenerate() {
    if (!confirm("Regenerate verify token? You'll need to re-verify the webhook on Facebook.")) return;
    setBusy(true);
    try {
      await regen();
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      toast.success("New verify token generated");
      pushLog("Verify token regenerated", true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSendTest() {
    if (!testPsid.trim()) {
      toast.error("Enter a Messenger PSID to test");
      return;
    }
    setBusy(true);
    try {
      await sendTest({ data: { recipient_id: testPsid.trim() } });
      toast.success("Test message sent");
      pushLog(`Sent test to ${testPsid.trim()}`, true);
    } catch (err) {
      toast.error((err as Error).message);
      pushLog(`Test send failed: ${(err as Error).message}`, false);
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshPerms() {
    setBusy(true);
    try {
      await refreshPerms();
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      toast.success("Permissions refreshed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFlag(key: string, v: boolean) {
    try {
      await updateFlags({ data: { [key]: v } as any });
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const daysToExpiry = useMemo(() => {
    if (!d.token_expires_at) return null;
    const ms = new Date(d.token_expires_at).getTime() - Date.now();
    return Math.floor(ms / 86400_000);
  }, [d.token_expires_at]);

  const statusPill = connected ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Connected</Badge>
  ) : d.status === "error" ? (
    <Badge variant="destructive">Error</Badge>
  ) : (
    <Badge variant="secondary">Not Connected</Badge>
  );

  const webhookPill = d.last_verified_at ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Verified</Badge>
  ) : (
    <Badge variant="secondary">Unverified</Badge>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Messenger Integration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Facebook Page so the AI agent can reply to Messenger chats automatically.
        </p>
      </div>

      {/* Dashboard */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {d.page_picture_url ? (
              <img
                src={d.page_picture_url}
                alt=""
                className="h-14 w-14 rounded-full border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                {d.page_name?.[0] ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">
                {d.page_name ?? "No page connected"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {d.page_id ? `Page ID: ${d.page_id}` : "Enter credentials below to connect"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {statusPill}
            {webhookPill}
            {d.ai_auto_reply ? (
              <Badge className="bg-primary hover:bg-primary">AI On</Badge>
            ) : (
              <Badge variant="outline">AI Off</Badge>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Msgs today" value={d.stats?.messages_today ?? 0} />
          <Stat label="Failed" value={d.stats?.failed_today ?? 0} />
          <Stat
            label="Last incoming"
            value={
              d.stats?.last_incoming_at
                ? new Date(d.stats.last_incoming_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </div>

        {daysToExpiry !== null && (
          <div
            className={
              "mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs " +
              (daysToExpiry < 7
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : "bg-muted")
            }
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Token expires in {daysToExpiry} day(s)
            {daysToExpiry < 7 && " — refresh soon"}
          </div>
        )}
        {d.last_error && (
          <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Last error: {d.last_error}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connection */}
        <form onSubmit={onConnect} className="space-y-4 rounded-xl border bg-card p-3 sm:p-4">
          <div className="text-sm font-semibold">Connection</div>
          <Field label="Facebook Page ID" required>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Long-lived Page Access Token" required>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={d.has_token ? "•••••• (leave empty to keep saved token)" : ""}
              />
              <IconBtn onClick={() => setShowToken((s) => !s)} title="Show/hide">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </IconBtn>
              <IconBtn onClick={() => copy(token, "Token copied")} title="Copy">
                <Copy className="h-4 w-4" />
              </IconBtn>
            </div>
          </Field>
          <Field label="App ID (optional)">
            <Input value={appId} onChange={(e) => setAppId(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="App Secret (optional, encrypted)">
            <div className="flex gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={d.has_app_secret ? "•••••• (leave empty to keep)" : ""}
              />
              <IconBtn onClick={() => setShowSecret((s) => !s)} title="Show/hide">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </IconBtn>
            </div>
          </Field>

          <div className="pt-2 text-xs font-semibold text-muted-foreground">App Information</div>
          <Field label="Privacy Policy URL" required>
            <div className="flex gap-2">
              <Input
                type="url"
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
                placeholder="https://yourdomain.com/privacy-policy"
                aria-invalid={!!privacyUrl && !privacyValid}
              />
              <IconBtn
                onClick={() => {
                  if (privacyValid) window.open(privacyUrl.trim(), "_blank", "noopener");
                  else toast.error("Enter a valid HTTPS URL first");
                }}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </IconBtn>
            </div>
            {privacyUrl && !privacyValid && (
              <p className="mt-1 text-xs text-destructive">
                Must be a valid HTTPS URL (e.g. https://yourdomain.com/privacy-policy)
              </p>
            )}
            {privacySaved && privacyValid && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </p>
            )}
          </Field>
          <Field label="Terms of Service URL (optional)">
            <div className="flex gap-2">
              <Input
                type="url"
                value={termsUrl}
                onChange={(e) => setTermsUrl(e.target.value)}
                placeholder="https://yourdomain.com/terms"
                aria-invalid={!!termsUrl && !termsValid}
              />
              <IconBtn
                onClick={() => {
                  if (termsUrl && termsValid) window.open(termsUrl.trim(), "_blank", "noopener");
                  else toast.error("Enter a valid HTTPS URL first");
                }}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </IconBtn>
            </div>
            {termsUrl && !termsValid && (
              <p className="mt-1 text-xs text-destructive">Must be a valid HTTPS URL</p>
            )}
            {termsSaved && termsValid && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </p>
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || !privacyValid || !termsValid}
              className="flex-1 sm:flex-none"
            >
              {busy ? "Saving…" : connected ? "Save changes" : "Connect"}
            </Button>
            {connected && (
              <>
                <Button type="button" variant="outline" onClick={onConnect} disabled={busy}>
                  Reconnect
                </Button>
                <Button type="button" variant="destructive" onClick={onDisconnect} disabled={busy}>
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </form>

        {/* Webhook */}
        <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Webhook</div>
            {webhookPill}
          </div>
          <Field label="Callback URL">
            <div className="flex gap-2">
              <Input readOnly value={d.webhook_url ?? ""} className="font-mono text-xs" />
              <IconBtn onClick={() => copy(d.webhook_url, "URL copied")} title="Copy">
                <Copy className="h-4 w-4" />
              </IconBtn>
            </div>
          </Field>
          <Field label="Verify Token">
            <div className="flex gap-2">
              <Input
                readOnly
                type={showVerify ? "text" : "password"}
                value={d.verify_token ?? ""}
                className="font-mono text-xs"
              />
              <IconBtn onClick={() => setShowVerify((s) => !s)} title="Show/hide">
                {showVerify ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </IconBtn>
              <IconBtn onClick={() => copy(d.verify_token, "Token copied")} title="Copy">
                <Copy className="h-4 w-4" />
              </IconBtn>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onVerify} disabled={busy || !d.verify_token}>
              Verify Webhook
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={busy}>
              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
              {d.verify_token ? "Regenerate" : "Generate Token"}
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            The verify token is generated automatically and stored securely. Copy it into
            Facebook's Webhook setup — you never need to invent one yourself.
          </div>
          <div className="text-xs text-muted-foreground">
            Last verified:{" "}
            {d.last_verified_at ? new Date(d.last_verified_at).toLocaleString() : "never"}
          </div>
          {d.last_error && (
            <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {d.last_error}
            </div>
          )}
          {diag && (
            <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <div className="font-semibold">Diagnostics</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <div>Endpoint reachable: {diag.reachable ? "✅" : "❌"}</div>
                <div>Token match: {diag.token_match ? "✅" : "❌"}</div>
                <div>GET status: {diag.get_status ?? "—"}</div>
                <div>POST status: {diag.post_status ?? "—"}</div>
                <div>Bad-token status: {diag.bad_token_status ?? "—"} (expected 403)</div>
                <div className="truncate">Response: <code>{(diag.get_body ?? "").slice(0, 60) || "—"}</code></div>
              </div>
              {diag.endpoint && (
                <div className="truncate text-muted-foreground">URL: {diag.endpoint}</div>
              )}
              {diag.error && <div className="text-destructive">Error: {diag.error}</div>}
            </div>
          )}
        </div>


        {/* Permissions */}
        <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Permissions</div>
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshPerms}
              disabled={busy || !connected}
            >
              Refresh
            </Button>
          </div>
          {!(d.app_id && d.has_app_secret) && (
            <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              Provide App ID and App Secret to enable permission checks.
            </div>
          )}
          <ul className="space-y-1.5 text-sm">
            {(d.required_scopes ?? [
              "pages_manage_metadata",
              "pages_messaging",
              "pages_read_engagement",
            ]).map((s: string) => {
              const has = (d.permissions ?? []).includes(s);
              return (
                <li key={s} className="flex items-center gap-2">
                  {has ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs">{s}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* AI Behavior */}
        <div className="space-y-2 rounded-xl border bg-card p-3 sm:p-4">
          <div className="text-sm font-semibold">AI Behavior</div>
          <FlagRow label="AI Auto Reply" value={!!d.ai_auto_reply} onChange={(v) => toggleFlag("ai_auto_reply", v)} disabled={!connected} />
          <FlagRow label="Human Takeover" value={!!d.human_takeover} onChange={(v) => toggleFlag("human_takeover", v)} disabled={!connected} />
          <FlagRow label="Conversation History" value={!!d.conversation_history} onChange={(v) => toggleFlag("conversation_history", v)} disabled={!connected} />
          <FlagRow label="Order Detection" value={!!d.order_detection} onChange={(v) => toggleFlag("order_detection", v)} disabled={!connected} />
          <FlagRow label="Product Recommendation" value={!!d.product_recommendation} onChange={(v) => toggleFlag("product_recommendation", v)} disabled={!connected} />
          <FlagRow label="FAQ Reply" value={!!d.faq_reply} onChange={(v) => toggleFlag("faq_reply", v)} disabled={!connected} />
        </div>
      </div>

      {/* Test tools + Log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
          <div className="text-sm font-semibold">Test tools</div>
          <Field label="Send test message to PSID">
            <div className="flex gap-2">
              <Input value={testPsid} onChange={(e) => setTestPsid(e.target.value)} placeholder="Messenger PSID" />
              <Button onClick={onSendTest} disabled={busy || !connected}>
                Send
              </Button>
            </div>
          </Field>
          <p className="text-xs text-muted-foreground">
            The PSID is the recipient's Messenger-scoped ID. It appears in the webhook payload
            (<code>sender.id</code>) when a user messages your Page.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="mb-2 text-sm font-semibold">Live event log</div>
          {log.length === 0 ? (
            <div className="text-xs text-muted-foreground">No events yet.</div>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {log.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  {e.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{e.text}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(e.at).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border bg-background px-2 text-muted-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="truncate text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function FlagRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
