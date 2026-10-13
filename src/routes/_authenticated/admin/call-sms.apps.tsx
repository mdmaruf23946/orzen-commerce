import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneCall, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { CALL_SMS_PROVIDERS } from "@/lib/call-sms-providers";
import { useProviderConnections } from "@/lib/use-call-sms-connections";
import { useState } from "react";
import { OrzenCallModal } from "@/components/admin/calls/OrzenCallModal";

export const Route = createFileRoute("/_authenticated/admin/call-sms/apps")({
  component: AppsHub,
  head: () => ({
    meta: [
      { title: "Call & SMS Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect & manage your Call & SMS providers." },
      { property: "og:title", content: "Call & SMS Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect & manage your Call & SMS providers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AppsHub() {
  const { connected, isLoading } = useProviderConnections();
  const [open, setOpen] = useState(false);
  return (
    <FeatureGate feature="call_center">
      <div className="space-y-4">
        <AdminPageHeader title="Call & SMS Apps" description="Connect a Call or SMS provider. Once connected, it gets its own menu in the sidebar." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CALL_SMS_PROVIDERS.map((p) => {
            const on = !!connected[p.id];
            const Icon = p.kind === "sms" ? MessageSquare : PhoneCall;
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.tag ?? (p.kind === "sms" ? "SMS" : p.kind === "call" ? "Call" : "Call & SMS")}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {on ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    {isLoading ? "…" : on ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{p.description}</p>
                {p.modal ? (
                  <Button size="sm" variant={on ? "outline" : "default"} className="mt-auto" onClick={() => setOpen(true)}>{on ? "Manage" : "Connect / Setup"}</Button>
                ) : (
                  <Button asChild size="sm" variant={on ? "outline" : "default"} className="mt-auto">
                    <Link to={p.path} search={{ tab: on ? "overview" : p.setupSection } as any}>{on ? "Manage" : "Connect / Setup"}</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <OrzenCallModal open={open} onOpenChange={setOpen} />
      </div>
    </FeatureGate>
  );
}
