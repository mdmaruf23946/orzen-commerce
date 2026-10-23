import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Wifi, Network, Globe, Building2, Server, Smartphone, Settings2, Pencil, Plug } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { PROVIDERS } from "@/lib/call-providers";
import { ConnectProviderDialog } from "@/components/admin/calls/ConnectProviderDialog";
import { useCallStore } from "@/components/admin/calls/useCallStore";

export const Route = createFileRoute("/_authenticated/admin/manual-call_/apps")({
  component: CallAppsPage,
  head: () => ({
    meta: [
      { title: "Call Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect Bangladeshi VoIP providers; all calls appear in one Calls Hub." },
      { property: "og:title", content: "Call Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect Bangladeshi VoIP providers; all calls appear in one Calls Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const ICONS: Record<string, any> = { brilliant: Radio, amberit: Wifi, link3: Network, bdcom: Globe, btcl: Building2, ummah: Server, mytel: Smartphone, custom: Settings2 };

function CallAppsPage() {
  const { configs } = useCallStore();
  const [open, setOpen] = useState<string | null>(null);
  const connected = Object.keys(configs).length;
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Call Apps" description="Connect your Bangladeshi VoIP provider. Every connected provider works together in the single Calls Hub." />
      {connected > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
          <span>{connected} provider{connected > 1 ? "s" : ""} connected</span>
          <Button asChild size="sm"><Link to="/admin/manual-call">Open Calls Hub</Link></Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PROVIDERS.map((p) => {
          const Icon = ICONS[p.id];
          const on = !!configs[p.id];
          return (
            <div key={p.id} className="flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${on ? "bg-primary" : "bg-destructive"}`} />{on ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="mt-3 font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{on ? `${configs[p.id].username} · ${configs[p.id].transport}` : "SIP / VoIP calling"}</div>
              <Button className="mt-4" size="sm" variant={on ? "outline" : "default"} onClick={() => setOpen(p.id)}>
                {on ? <><Pencil className="mr-1 h-4 w-4" />Edit</> : <><Plug className="mr-1 h-4 w-4" />Connect</>}
              </Button>
            </div>
          );
        })}
      </div>
      <ConnectProviderDialog providerId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
