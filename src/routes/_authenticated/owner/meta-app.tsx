import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  getMetaAppConfig,
  saveMetaAppConfig,
  testMetaAppConfig,
  clearMetaAppConfig,
} from "@/lib/owner-meta-app.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/owner/meta-app")({ component: Page });

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Page() {
  const get = useServerFn(getMetaAppConfig);
  const save = useServerFn(saveMetaAppConfig);
  const test = useServerFn(testMetaAppConfig);
  const clear = useServerFn(clearMetaAppConfig);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["owner", "metaApp"], queryFn: () => get() });

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setAppId(data.app_id ?? "");
  }, [data]);

  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { app_id: appId.trim(), app_secret: appSecret.trim() || null } });
      setAppSecret("");
      toast.success("Saved — Auto Connect is now live for every merchant");
      qc.invalidateQueries({ queryKey: ["owner", "metaApp"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    try {
      const r = await test();
      if (r.ok) toast.success("Facebook accepted these credentials");
      else toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Meta App / Auto Connect"
        description="One platform Facebook app powers Auto Connect on every merchant's Messenger and WhatsApp page."
        actions={
          <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
            Test connection
          </Button>
        }
      />

      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            data.configured ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          {data.configured ? <Check className="mt-0.5 h-5 w-5" /> : <TriangleAlert className="mt-0.5 h-5 w-5" />}
          <div className="text-sm">
            <p className="font-medium">
              {data.configured ? "Auto Connect is active for all merchants" : "Auto Connect is not configured yet"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {data.configured
                ? data.from_environment
                  ? "Currently using hosting environment values. Saving below moves them into the panel."
                  : `Last updated ${data.updated_at ? new Date(data.updated_at).toLocaleString() : "—"}.`
                : "Until it is set, merchants can still use Manual Connect on both integration pages."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 font-semibold">Facebook app credentials</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            From Meta Developers → your app → Settings → Basic.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>App ID</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890123456" />
            </div>
            <div>
              <Label>App Secret</Label>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={data.has_secret ? `Saved (${data.secret_masked}) — leave blank to keep` : "Paste the app secret"}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={submit} disabled={saving || !appId.trim()}>
              {saving ? "Checking with Facebook…" : "Verify & save"}
            </Button>
            {(data.app_id || data.has_secret) && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!confirm("Remove the saved Facebook app? Auto Connect will stop for merchants.")) return;
                  await clear();
                  setAppSecret("");
                  toast.success("Removed");
                  qc.invalidateQueries({ queryKey: ["owner", "metaApp"] });
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 font-semibold">Settings to paste into the Meta app</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Add the Facebook Login product, then paste this redirect URI into “Valid OAuth Redirect URIs”.
          </p>
          <div className="space-y-3">
            <CopyRow label="Valid OAuth Redirect URI" value={data.redirect_uri} />
            <CopyRow label="App domain" value={data.redirect_uri.replace(/^https?:\/\//, "").split("/")[0] ?? ""} />
            <CopyRow label="Messenger permissions" value={data.messenger_scopes.join(", ")} />
            <CopyRow label="WhatsApp permissions" value={data.whatsapp_scopes.join(", ")} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">How merchants use it</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Merchant opens Messenger or WhatsApp integration in their panel.</li>
            <li>They press “Auto Connect” and sign in with Facebook.</li>
            <li>They pick a Page or WhatsApp number — tokens and webhooks are wired automatically.</li>
            <li>Manual Connect stays available for anyone who prefers it.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
