import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { InstagramMark } from "@/components/admin/brand/InstagramMark";
import { Button } from "@/components/ui/button";
import { connectInstagram, disconnectInstagram, getInstagramIntegration } from "@/lib/instagram.functions";

export const Route = createFileRoute("/_authenticated/admin/instagram")({
  head: () => ({
    meta: [
      { title: "Instagram Integration — ORZEN Merchant Panel" },
      { name: "description", content: "Connect Instagram Direct messages to the AI sales agent and Omni Inbox." },
      { property: "og:title", content: "Instagram Integration — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect Instagram Direct messages to the AI sales agent and Omni Inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_messenger">
      <InstagramPage />
    </FeatureGate>
  ),
});

const STEPS = [
  "Instagram অ্যাপে আপনার account-কে Professional (Business বা Creator) করুন।",
  "Instagram account-টি আপনার Facebook Page-এর সাথে link করুন (Meta Business Suite থেকে)।",
  "Instagram অ্যাপে: Settings → Messages and story replies → Message controls → Connected tools → “Allow access to messages” চালু করুন।",
  "Messenger পেজে Facebook Page manual connect করা থাকতে হবে; Page token-এ instagram_basic ও instagram_manage_messages অনুমতি দিন।",
  "Meta App → Webhooks → Instagram-এ নিচের Callback URL ও Verify Token বসিয়ে messages field subscribe করুন।",
  "Meta Business Suite / Graph API Explorer থেকে Instagram Business Account ID কপি করে নিচে বসিয়ে Connect করুন।",
];

function InstagramPage() {
  const qc = useQueryClient();
  const get = useServerFn(getInstagramIntegration);
  const connect = useServerFn(connectInstagram);
  const disconnect = useServerFn(disconnectInstagram);
  const [busy, setBusy] = useState(false);
  const [igId, setIgId] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["ai-messaging", "instagram"], queryFn: () => get() });

  async function onConnect() {
    setBusy(true);
    try {
      if (!igId.trim()) { toast.error("Instagram Business Account ID দিন"); return; }
      const r: any = await connect({ data: { instagram_account_id: igId.trim() } });
      if (!r.ok) toast.error(r.error);
      else { toast.success(`Instagram ${r.username ? "@" + r.username : ""} connect হয়েছে`); setIgId(""); }
      qc.invalidateQueries({ queryKey: ["ai-messaging", "instagram"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function onDisconnect() {
    setBusy(true);
    try {
      await disconnect();
      toast.success("Instagram বিচ্ছিন্ন করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["ai-messaging", "instagram"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <InstagramMark size={48} />
        <div>
          <h1 className="text-2xl font-semibold">Instagram AI</h1>
          <p className="text-sm text-muted-foreground">Instagram Direct-এর মেসেজ AI উত্তর দেবে এবং সব চ্যাট Omni Inbox-এ আসবে।</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : data?.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            {data.picture ? <img src={data.picture} alt="" className="h-10 w-10 rounded-full" /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Connected {data.username ? `@${data.username}` : ""}
              </div>
              <p className="text-xs text-muted-foreground">Facebook Page: {data.pageName ?? "—"} · AI সেটিংস Messenger-এর মতোই কাজ করবে।</p>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/admin/omni-inbox">Inbox খুলুন</Link></Button>
            <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy}>Disconnect</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              {data?.pageConnected
                ? `Facebook Page “${data.pageName ?? ""}” connect করা আছে। এখন Instagram connect করুন।`
                : "আগে Messenger-এ আপনার Facebook Page connect করুন।"}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium">Instagram Business Account ID</label>
              <Input value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="1784xxxxxxxxxxxx" inputMode="numeric" disabled={!data?.pageConnected} />
            </div>
            <div className="flex gap-2">
              <Button onClick={onConnect} disabled={busy || !data?.pageConnected}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Instagram Connect করুন
              </Button>
              {!data?.pageConnected && (
                <Button asChild variant="outline"><Link to="/admin/messenger">Messenger connect</Link></Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-medium">Meta Webhook (Instagram)</h2>
        <p className="text-xs text-muted-foreground">Callback URL</p>
        <code className="block break-all rounded bg-muted px-2 py-1 text-xs">https://orzen.top/api/public/messenger/webhook</code>
        <p className="text-xs text-muted-foreground">Verify Token (Messenger-এর মতোই)</p>
        <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{data?.verifyToken ?? "আগে Messenger connect করুন"}</code>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-medium">Connect করার আগে যা লাগবে</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}
