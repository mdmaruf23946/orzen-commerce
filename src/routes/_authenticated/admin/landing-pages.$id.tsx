import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, RefreshCw, Send } from "lucide-react";
import {
  getLandingPageConnection,
  listLandingPageLogs,
  rotateLandingPageApiKey,
  rotateLandingPageWebhookSecret,
  sendLandingPageTestOrder,
  updateLandingPageConnection,
} from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/landing-pages/$id")({
  head: () => ({ meta: [{ title: "Landing page connection — Store Admin" }] }),
  component: () => (
    <FeatureGate feature="landing_pages">
      <Detail />
    </FeatureGate>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getLandingPageConnection);
  const logsFn = useServerFn(listLandingPageLogs);
  const rotSec = useServerFn(rotateLandingPageWebhookSecret);
  const rotKey = useServerFn(rotateLandingPageApiKey);
  const testFn = useServerFn(sendLandingPageTestOrder);
  const updFn = useServerFn(updateLandingPageConnection);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["landing-page", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["landing-page", id, "logs"],
    queryFn: () => logsFn({ data: { id, limit: 100 } }),
  });

  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  if (isLoading || !data) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const conn = data.connection as any;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${base}/api/public/landing-pages/${id}/orders`;
  const apiUrl = `${base}/api/public/landing-pages/${id}/api/orders`;
  const embedUrl = `${base}/api/public/landing-pages/${id}/embed/orders`;

  function copy(v: string) { navigator.clipboard.writeText(v).then(() => toast.success("Copied")); }

  async function rotateSecret() {
    if (!confirm("Rotate webhook secret? The old one will stop working immediately.")) return;
    const r = await rotSec({ data: { id } });
    setNewSecret((r as any).webhook_secret);
    qc.invalidateQueries({ queryKey: ["landing-page", id] });
  }
  async function rotateKey() {
    if (!confirm("Rotate API key? The old one will stop working immediately.")) return;
    const r = await rotKey({ data: { id } });
    setNewKey((r as any).api_key);
    qc.invalidateQueries({ queryKey: ["landing-page", id] });
  }
  async function sendTest() {
    try {
      const r = await testFn({ data: { id } });
      const body = (r as any)?.body;
      if (body?.ok) toast.success(body.duplicate ? "Duplicate — order already exists" : "Test order created");
      else toast.error(body?.error ?? "Test failed");
      qc.invalidateQueries({ queryKey: ["landing-page", id, "logs"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggleStatus() {
    await updFn({ data: { id, status: conn.status === "active" ? "paused" : "active" } });
    qc.invalidateQueries({ queryKey: ["landing-page", id] });
  }

  const shownRows = [
    { label: "Webhook URL", value: webhookUrl },
    { label: "API URL", value: apiUrl },
    { label: "Embed URL", value: embedUrl },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/landing-pages"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{conn.name}</h1>
          <div className="text-xs text-muted-foreground">
            {conn.platform} · {conn.method} · {conn.status}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={sendTest}><Send className="mr-1 h-3 w-3" /> Test order</Button>
          <Button variant="outline" size="sm" onClick={toggleStatus}>
            {conn.status === "active" ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Orders received" value={conn.orders_received ?? 0} />
            <Stat label="Failed" value={conn.failed_count ?? 0} />
            <Stat label="Last order" value={conn.last_order_at ? new Date(conn.last_order_at).toLocaleString() : "—"} />
            <Stat label="Created" value={new Date(conn.created_at).toLocaleDateString()} />
          </div>
          {conn.last_error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              Last error: {conn.last_error}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Endpoints</div>
            <div className="space-y-2">
              {shownRows.map((row) => (
                <div key={row.label}>
                  <Label className="text-xs">{row.label}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={row.value} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(row.value)}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Webhook secret</div>
              <Button variant="outline" size="sm" onClick={rotateSecret}><RefreshCw className="mr-1 h-3 w-3" /> Regenerate</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {data.credentials?.has_webhook_secret ? "A secret is on file. It is never shown again after creation." : "No secret set — regenerate to create one."}
            </div>
            {newSecret && (
              <div className="mt-3">
                <Label className="text-xs">New webhook secret (copy now)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={newSecret} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(newSecret)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">API key</div>
                <div className="text-xs text-muted-foreground">
                  {data.credentials?.api_key_last4 ? `Ending in ${data.credentials.api_key_last4}` : "No key set"}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={rotateKey}><RefreshCw className="mr-1 h-3 w-3" /> Regenerate</Button>
            </div>
            {newKey && (
              <div className="mt-3">
                <Label className="text-xs">New API key (copy now)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={newKey} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(newKey)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="pt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            {logs.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              <ul className="divide-y text-xs">
                {logs.map((l: any) => (
                  <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${statusClass(l.status)}`}>{l.status}</span>
                        <span className="font-mono">{l.external_order_id ?? l.order_id?.slice(0, 8) ?? "—"}</span>
                        {l.processing_ms != null && <span className="text-muted-foreground">{l.processing_ms}ms</span>}
                      </div>
                      {l.error && <div className="mt-1 text-red-600">{l.error}</div>}
                    </div>
                    <div className="text-muted-foreground">{new Date(l.received_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 pt-4 text-sm">
          <div className="rounded-xl border bg-card p-4">
            <div className="font-semibold">Webhook (HMAC)</div>
            <p className="mt-2 text-xs text-muted-foreground">
              POST JSON to <code className="font-mono">{webhookUrl}</code> with headers:
            </p>
            <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{`X-Timestamp: <unix seconds>
X-Signature: sha256=<hex HMAC-SHA256 of the raw body using your webhook secret>
Content-Type: application/json`}</pre>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="font-semibold">API key</div>
            <p className="mt-2 text-xs text-muted-foreground">
              POST JSON to <code className="font-mono">{apiUrl}</code> with header{" "}
              <code className="font-mono">Authorization: Bearer &lt;API_KEY&gt;</code>.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="font-semibold">Embed / HTML form</div>
            <p className="mt-2 text-xs text-muted-foreground">
              POST JSON or form-encoded data to <code className="font-mono">{embedUrl}</code>. No secret required —
              recommended for simple HTML landing pages.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="font-semibold">Expected fields</div>
            <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{`{
  "customer_name": "…",
  "phone": "…",
  "address": "…",
  "area": "Dhaka",
  "quantity": 1,
  "external_product_id": "SKU-OR-ID",   // or omit to use default product
  "external_order_id": "…",             // idempotency key (recommended)
  "landing_page_url": "https://…",
  "utm_source": "…", "utm_campaign": "…", "fbclid": "…"
}`}</pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}

function statusClass(s: string) {
  switch (s) {
    case "success": return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200";
    case "duplicate": return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "test": return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "unauthorized":
    case "invalid":
    case "failed": return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
    default: return "bg-muted text-muted-foreground";
  }
}
