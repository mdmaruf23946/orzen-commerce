import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Plug, PlugZap, RefreshCw, Save, Sparkles } from "lucide-react";
import {
  getFacebookPage, connectFacebookPage, importMessengerPageCredentials, reverifyFacebookPage,
  setFacebookWebhookEnabled,
  disconnectFacebookPage, getFacebookAiSettings, saveFacebookAiSettings,
} from "@/lib/facebook-page.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Section, StatusPill, formatWhen, FB_BLUE } from "@/components/admin/facebook/ui";

export const Route = createFileRoute("/_authenticated/admin/facebook/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Facebook Page Settings | ORZEN Merchant Panel" },
      {
        name: "description",
        content: "Connect your Facebook Page, import Messenger credentials and configure AI comment management for your store.",
      },
      { property: "og:title", content: "Facebook Page Settings | ORZEN Merchant Panel" },
      { property: "og:description", content: "Facebook Page connection and AI comment moderation settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type AiForm = {
  enabled: boolean;
  mode: "suggest" | "auto";
  tone: "friendly" | "professional" | "casual";
  language: "bn" | "en" | "auto";
  auto_reply_safe: boolean;
  auto_hide_spam: boolean;
  suggest_messenger_handoff: boolean;
  allow_keywords: string[];
  deny_keywords: string[];
  custom_instructions: string;
};

function SettingsPage() {
  const qc = useQueryClient();
  const pageFn = useServerFn(getFacebookPage);
  const connectFn = useServerFn(connectFacebookPage);
  const importFn = useServerFn(importMessengerPageCredentials);
  const verifyFn = useServerFn(reverifyFacebookPage);
  const disconnectFn = useServerFn(disconnectFacebookPage);
  const webhookFn = useServerFn(setFacebookWebhookEnabled);
  const aiGet = useServerFn(getFacebookAiSettings);
  const aiSave = useServerFn(saveFacebookAiSettings);

  const { data: page, isLoading } = useQuery({ queryKey: ["fbpage", "overview"], queryFn: () => pageFn() });
  const { data: ai } = useQuery({ queryKey: ["fbpage", "ai"], queryFn: () => aiGet() });

  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<AiForm | null>(null);

  useEffect(() => {
    if (ai && !form) {
      setForm({
        enabled: !!ai.enabled,
        mode: (ai.mode ?? "suggest") as AiForm["mode"],
        tone: (ai.tone ?? "friendly") as AiForm["tone"],
        language: (ai.language ?? "bn") as AiForm["language"],
        auto_reply_safe: !!ai.auto_reply_safe,
        auto_hide_spam: !!ai.auto_hide_spam,
        suggest_messenger_handoff: ai.suggest_messenger_handoff !== false,
        allow_keywords: (ai.allow_keywords ?? []) as string[],
        deny_keywords: (ai.deny_keywords ?? []) as string[],
        custom_instructions: ai.custom_instructions ?? "",
      });
    }
  }, [ai, form]);

  async function act(key: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;

  const set = <K extends keyof AiForm>(k: K, v: AiForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-4">
      <Section
        title="Facebook Page connection"
        description="This connection belongs to the Facebook Page module only — your Messenger AI Agent keeps its own."
        action={<StatusPill status={page?.status ?? "not_connected"} />}
      >
        {page?.connected ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <div className="font-medium">{page.page_name}</div>
              <div className="text-muted-foreground">Page ID: {page.page_id}</div>
              <div className="text-muted-foreground">Last verified: {formatWhen(page.last_verified_at)}</div>
              {page.last_error && <div className="mt-1 text-destructive">{page.last_error}</div>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => act("verify", () => verifyFn(), "Connection verified")}
                disabled={busy !== null}
                className="w-full sm:w-auto"
              >
                {busy === "verify" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Re-verify
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 sm:w-auto"
                onClick={() => act("disconnect", () => disconnectFn(), "Page disconnected")}
                disabled={busy !== null}
              >
                <Plug className="mr-1.5 h-4 w-4" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {page?.messenger_page && (
              <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  <div className="font-medium">Use my Messenger page</div>
                  <div className="text-muted-foreground">
                    Copy credentials from {page.messenger_page.page_name ?? page.messenger_page.page_id}. Your Messenger
                    setup stays untouched.
                  </div>
                </div>
                <Button
                  size="sm"
                  style={{ backgroundColor: FB_BLUE }}
                  disabled={busy !== null}
                  onClick={() => act("import", () => importFn(), "Imported from Messenger")}
                >
                  {busy === "import" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  Import
                </Button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Page ID</Label>
                <Input value={pageId} onChange={(e) => setPageId(e.target.value.trim())} placeholder="1234567890" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Page access token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  placeholder="EAAB…"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">App ID (optional)</Label>
                <Input value={appId} onChange={(e) => setAppId(e.target.value.trim())} placeholder="Meta app ID" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">App secret (optional)</Label>
                <Input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value.trim())}
                  placeholder="••••••••"
                  autoComplete="off"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Needed permissions: pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement,
              pages_messaging. Only the actions your token grants will be enabled.
            </p>

            <Button
              onClick={() =>
                act(
                  "connect",
                  () =>
                    connectFn({
                      data: {
                        page_id: pageId,
                        page_access_token: token,
                        app_id: appId || null,
                        app_secret: appSecret || null,
                      },
                    }),
                  "Facebook Page connected",
                )
              }
              disabled={busy !== null || !pageId || !token}
              style={{ backgroundColor: FB_BLUE }}
              className="w-full sm:w-auto"
            >
              {busy === "connect" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlugZap className="mr-1.5 h-4 w-4" />}
              Connect page
            </Button>
          </div>
        )}
      </Section>

      {page?.connected && page.webhook && (
        <Section
          title="Live sync (webhook)"
          description="Paste these into your Meta app so new posts and comments appear here without pressing Sync."
        >
          <div className="space-y-3">
            <Field label="Callback URL" value={page.webhook.callback_url} />
            <Field label="Verify token" value={page.webhook.verify_token ?? "—"} />

            {!page.has_app_secret && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700">
                Live sync needs your <b>App secret</b> — incoming events are signed by Meta and are rejected without it.
                Disconnect and reconnect the page with the App ID and App secret filled in.
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-muted-foreground">
                Page subscription:{" "}
                <b className={sub.data ? (sub.data.subscribed ? "text-emerald-600" : "text-amber-600") : ""}>
                  {sub.isFetching ? "checking…" : sub.data ? (sub.data.subscribed ? `active (${sub.data.fields.join(", ")})` : "not subscribed") : "unknown"}
                </b>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  act("subscribe", async () => {
                    await subFn({ data: { subscribe: true } });
                    await sub.refetch();
                  }, "Page subscribed to live sync")
                }
              >
                {busy === "subscribe" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Subscribe page
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              In your Meta app: Webhooks → Page → subscribe to the <b>feed</b> field, then paste the URL and token above.
              {page.token_expires_at ? ` Page token expires ${formatWhen(page.token_expires_at)}.` : " Page token does not expire."}
              {page.webhook.last_webhook_at
                ? ` Last event received ${formatWhen(page.webhook.last_webhook_at)}.`
                : " No events received yet."}
            </p>

            <Toggle
              label="Live sync enabled"
              hint="Turn off to ignore incoming Facebook events."
              checked={page.webhook.enabled}
              onChange={async (v) => {
                try {
                  await webhookFn({ data: { enabled: v } });
                  qc.invalidateQueries({ queryKey: ["fbpage"] });
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </div>
        </Section>
      )}

      {form && (
        <Section
          title="AI comment management"
          description="The AI categorises comments and drafts replies. Suggest-only is the default — nothing is posted without you."
        >
          <div className="space-y-3">
            <Toggle label="Enable AI" hint="Analyse comments and prepare replies." checked={form.enabled} onChange={(v) => set("enabled", v)} />

            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label="Mode"
                value={form.mode}
                onChange={(v) => set("mode", v as AiForm["mode"])}
                options={[
                  { v: "suggest", l: "Suggest only" },
                  { v: "auto", l: "Automatic" },
                ]}
              />
              <SelectField
                label="Tone"
                value={form.tone}
                onChange={(v) => set("tone", v as AiForm["tone"])}
                options={[
                  { v: "friendly", l: "Friendly" },
                  { v: "professional", l: "Professional" },
                  { v: "casual", l: "Casual" },
                ]}
              />
              <SelectField
                label="Language"
                value={form.language}
                onChange={(v) => set("language", v as AiForm["language"])}
                options={[
                  { v: "bn", l: "Bangla" },
                  { v: "en", l: "English" },
                  { v: "auto", l: "Match customer" },
                ]}
              />
            </div>

            <Toggle
              label="Auto-reply to safe comments"
              hint="Only used when mode is Automatic. Questions and praise only."
              checked={form.auto_reply_safe}
              onChange={(v) => set("auto_reply_safe", v)}
            />
            <Toggle
              label="Auto-hide spam"
              hint="Hide comments the AI marks as spam."
              checked={form.auto_hide_spam}
              onChange={(v) => set("auto_hide_spam", v)}
            />
            <Toggle
              label="Suggest Messenger handoff"
              hint="Recommend moving order conversations to Messenger."
              checked={form.suggest_messenger_handoff}
              onChange={(v) => set("suggest_messenger_handoff", v)}
            />

            <div className="space-y-1.5">
              <Label className="text-xs">Spam keywords (comma separated)</Label>
              <Input
                value={form.deny_keywords.join(", ")}
                onChange={(e) => set("deny_keywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50))}
                placeholder="loan, casino, free followers"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Custom instructions</Label>
              <Textarea
                rows={3}
                value={form.custom_instructions}
                onChange={(e) => set("custom_instructions", e.target.value)}
                placeholder="Always mention free delivery inside Dhaka…"
              />
            </div>

            <Button
              onClick={() => act("ai", () => aiSave({ data: { ...form, custom_instructions: form.custom_instructions || null } }), "AI settings saved")}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              {busy === "ai" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save AI settings
            </Button>
            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Run “AI review” on the Comments tab to categorise the latest comments.
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}
