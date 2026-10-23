import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plug } from "lucide-react";
import { ProviderLogo } from "@/components/admin/calls/ProviderLogo";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { PROVIDERS, KIND_LABEL } from "@/lib/call-providers";
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


function CallAppsPage() {
  const { configs } = useCallStore();
  const [open, setOpen] = useState<string | null>(null);
  const all = Object.values(configs);
  const connected = all.length;
  return (
    <div className="space-y-4">
      <AdminPageHeader title="Call Apps" description="Connect your Bangladeshi VoIP provider. Every connected provider works together in the single Calls Hub." />
      {connected > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
          <span>{connected} number{connected > 1 ? "s" : ""} connected</span>
          <Button asChild size="sm"><Link to="/admin/manual-call" search={{ tab: undefined }}>Open Calls Hub</Link></Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PROVIDERS.map((p) => {
          const mine = all.filter((c) => c.providerId === p.id);
          const on = mine.length > 0;
          const extCount = mine.reduce((n, c) => n + (c.extensions?.length ?? 0), 0);
          return (
            <div key={p.id} className="flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <ProviderLogo id={p.id} name={p.name} className="h-12 w-12" />
                <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${on ? "bg-primary" : "bg-destructive"}`} />{on ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="mt-3 font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{on ? `${mine.length} number · ${extCount} extension` : p.tagline}</div>
              <span className="mt-2 w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{KIND_LABEL[p.kind]}</span>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" size="sm" variant={on ? "outline" : "default"} onClick={() => setOpen(p.id)}>
                  {on ? <><Plug className="mr-1 h-4 w-4" />Add number</> : <><Plug className="mr-1 h-4 w-4" />Connect</>}
                </Button>
                {on && <Button asChild size="sm" variant="outline"><Link to="/admin/manual-call" search={{ tab: "setup" }}><Pencil className="mr-1 h-4 w-4" />Manage</Link></Button>}
              </div>
            </div>
          );
        })}
      </div>
      <ConnectProviderDialog providerId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
