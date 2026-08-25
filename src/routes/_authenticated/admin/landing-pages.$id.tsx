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
  head: () => ({
    meta: [
      { title: "Landing Page Connection — ORZEN Merchant Panel" },
      { name: "description", content: "Configure an external landing page connection for your store." },
      { property: "og:title", content: "Landing Page Connection — ORZEN Merchant Panel" },
      { property: "og:description", content: "Configure an external landing page connection for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }), => (
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
