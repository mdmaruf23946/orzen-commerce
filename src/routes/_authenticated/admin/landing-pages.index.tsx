import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, Pause, Play, Copy, Send, RefreshCw } from "lucide-react";
import {
  listLandingPageConnections,
  landingPageStats,
  createLandingPageConnection,
  deleteLandingPageConnection,
  updateLandingPageConnection,
  sendLandingPageTestOrder,
} from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/landing-pages/")({
  head: () => ({
    meta: [
      { title: "Landing Page Integrations — ORZEN Merchant Panel" },
      { name: "description", content: "Connect external landing pages and receive orders automatically." },
      { property: "og:title", content: "Landing Page Integrations — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect external landing pages and receive orders automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="landing_pages">
      <LandingPagesIndex />
    </FeatureGate>
  ),
});

const PLATFORMS = [
  "custom", "wordpress", "woocommerce", "shopify", "webflow", "wix",
  "custom_php", "custom_react", "universal", "other",
] as const;

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-slate-400",
  pending: "bg-amber-500",
  failed: "bg-red-500",
};

function LandingPagesIndex() {
  const list = useServerFn(listLandingPageConnections);
  const stats = useServerFn(landingPageStats);
  const del = useServerFn(deleteLandingPageConnection);
  const upd = useServerFn(updateLandingPageConnection);
  const test = useServerFn(sendLandingPageTestOrder);
  const qc = useQueryClient();

  const { data: conns = [], isLoading } = useQuery({
    queryKey: ["landing-pages", "list"],
    queryFn: () => list(),
  });
  const { data: s } = useQuery({
    queryKey: ["landing-pages", "stats"],
    queryFn: () => stats(),
  });

  const [wizOpen, setWizOpen] = useState(false);
  const [credsShown, setCredsShown] = useState<null | { id: string; api_key: string; webhook_secret: string }>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["landing-pages"] });
  }

  async function toggleStatus(c: any) {
    await upd({ data: { id: c.id, status: c.status === "active" ? "paused" : "active" } });
    toast.success(c.status === "active" ? "Paused" : "Resumed");
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this landing page connection? Its orders remain, but the integration will stop receiving new ones.")) return;
    await del({ data: { id } });
    toast.success("Connection deleted");
    refresh();
  }

  async function sendTest(id: string) {
    try {
      const r = await test({ data: { id } });
      if ((r as any)?.body?.ok) toast.success("Test order created");
      else toast.error((r as any)?.body?.error ?? "Test failed");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cards: Array<{ label: string; value: string | number }> = [
    { label: "Connected", value: s?.connected ?? 0 },
    { label: "Active", value: s?.active ?? 0 },
    { label: "Orders received", value: s?.orders_received ?? 0 },
    { label: "Orders today", value: s?.orders_today ?? 0 },
    { label: "Failed (24h)", value: s?.failed_24h ?? 0 },
    { label: "Last order", value: s?.last_order_at ? new Date(s.last_order_at).toLocaleString() : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Landing Page Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect external landing pages and automatically receive their orders in your Merchant Panel.
          </p>
        </div>
        <Button onClick={() => setWizOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Connect Landing Page
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-3">
            <div className="text-[11px] uppercase text-muted-foreground">{c.label}</div>
            <div className="mt-1 truncate text-lg font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : conns.length === 0 ? (
          <div className="space-y-3 p-10 text-center">
            <div className="text-sm font-medium">No connections yet</div>
            <div className="text-xs text-muted-foreground">
              Click "Connect Landing Page" to receive orders from any external page.
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {conns.map((c: any) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-400"}`} />
                    <div className="truncate font-medium">{c.name}</div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{c.platform}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{c.method}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {c.url ?? "No URL"} · {c.orders_received ?? 0} orders
                    {c.last_order_at ? ` · last ${new Date(c.last_order_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link to="/admin/landing-pages/$id" params={{ id: c.id }}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <ExternalLink className="h-3 w-3" /> View
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => sendTest(c.id)}>
                    <Send className="h-3 w-3" /> Test
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => toggleStatus(c)}>
                    {c.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {c.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => remove(c.id)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConnectWizard
        open={wizOpen}
        onOpenChange={setWizOpen}
        onCreated={(res) => {
          setCredsShown(res);
          refresh();
        }}
      />

      <CredentialsDialog open={!!credsShown} data={credsShown} onClose={() => setCredsShown(null)} />
    </div>
  );
}

function ConnectWizard({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (r: { id: string; api_key: string; webhook_secret: string }) => void;
}) {
  const create = useServerFn(createLandingPageConnection);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("custom");
  const [method, setMethod] = useState<"webhook" | "api" | "embed">("webhook");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error("Integration name is required"); return; }
    setSaving(true);
    try {
      const r = await create({
        data: { name: name.trim(), url: url.trim() || undefined, description: description.trim() || undefined, platform, method },
      });
      onOpenChange(false);
      setName(""); setUrl(""); setDescription(""); setPlatform("custom"); setMethod("webhook");
      onCreated(r as any);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect landing page</DialogTitle>
          <DialogDescription>Give the connection a name and pick a platform and method.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Integration name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HY300 Projector Landing Page" />
          </div>
          <div>
            <Label>Landing page URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hy300" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook (HMAC)</SelectItem>
                  <SelectItem value="api">API key</SelectItem>
                  <SelectItem value="embed">Embed / JS form</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  open, data, onClose,
}: {
  open: boolean;
  data: null | { id: string; api_key: string; webhook_secret: string };
  onClose: () => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  if (!data) return null;
  const webhookUrl = `${base}/api/public/landing-pages/${data.id}/orders`;
  const apiUrl = `${base}/api/public/landing-pages/${data.id}/api/orders`;
  const embedUrl = `${base}/api/public/landing-pages/${data.id}/embed/orders`;

  function copy(v: string) {
    navigator.clipboard.writeText(v).then(() => toast.success("Copied"));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save these credentials now</DialogTitle>
          <DialogDescription>
            The API key and webhook secret will not be shown again. You can rotate them later from the connection page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {[
            { label: "Webhook URL", value: webhookUrl },
            { label: "Webhook secret", value: data.webhook_secret },
            { label: "API URL", value: apiUrl },
            { label: "API key", value: data.api_key },
            { label: "Embed URL", value: embedUrl },
          ].map((row) => (
            <div key={row.label}>
              <Label>{row.label}</Label>
              <div className="flex gap-2">
                <Input readOnly value={row.value} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(row.value)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Link to="/admin/landing-pages/$id" params={{ id: data.id }} onClick={onClose}>
            <Button className="gap-1"><RefreshCw className="h-4 w-4" /> Open connection</Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
