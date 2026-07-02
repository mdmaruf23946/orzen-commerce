import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { connectMessenger, disconnectMessenger, getMessengerIntegration } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/messenger")({
  component: () => <FeatureGate feature="ai_messenger"><AdminMessenger /></FeatureGate>,
});

function AdminMessenger() {
  const fetchIntegration = useServerFn(getMessengerIntegration);
  const connect = useServerFn(connectMessenger);
  const disconnect = useServerFn(disconnectMessenger);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "messenger"], queryFn: () => fetchIntegration() });

  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/messenger/webhook`
      : "/api/public/messenger/webhook";

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await connect({ data: { page_id: pageId.trim(), page_access_token: token.trim() } });
      setPageId("");
      setToken("");
      qc.invalidateQueries({ queryKey: ["admin", "messenger"] });
      toast.success("Connected");
    } catch (err) {
      toast.error((err as Error).message);
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
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Messenger Integration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Facebook Page so the AI agent can reply to Messenger chats automatically.
        </p>
      </div>

      {data ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="font-semibold text-emerald-600">{data.status ?? "connected"}</div>
            </div>
            <Button variant="destructive" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
          <Row label="Page ID" value={data.page_id} />
          <Row label="Verify token" value={data.verify_token} mono />
          <Row label="Webhook URL" value={webhookUrl} mono />
          <p className="text-xs text-muted-foreground">
            In Facebook App → Webhooks, set the Callback URL and Verify Token above, subscribe to <code>messages</code>{" "}
            and <code>messaging_postbacks</code>, then subscribe the Page.
          </p>
        </div>
      ) : (
        <form onSubmit={onConnect} className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Facebook Page ID</label>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Page Access Token</label>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              Generate a long-lived Page Access Token in your Facebook App dashboard.
            </p>
          </div>
          <div className="rounded-md bg-muted p-3 text-xs">
            <div className="font-medium">Webhook URL (to paste into Facebook)</div>
            <div className="mt-1 break-all font-mono">{webhookUrl}</div>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t pt-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "break-all text-right font-mono text-xs" : "text-right"}>{value ?? "—"}</span>
    </div>
  );
}
