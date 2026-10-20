import { createFileRoute, Link } from "@tanstack/react-router";
import { AI_MESSAGING_APPS, useAiMessagingConnections } from "@/lib/ai-messaging-apps";
import { StatusBadge } from "@/components/admin/marketing/ui";
import { MessengerMark } from "@/components/admin/brand/MessengerMark";
import { WhatsAppMark } from "@/components/admin/brand/WhatsAppMark";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

function WebChatMark({ size = 40 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-full bg-primary text-primary-foreground" style={{ width: size, height: size }}>
      <Globe style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/admin/ai-messaging/apps")({
  head: () => ({
    meta: [
      { title: "AI Messaging Apps — ORZEN Merchant Panel" },
      { name: "description", content: "Connect Messenger AI and WhatsApp AI for your store." },
      { property: "og:title", content: "AI Messaging Apps — ORZEN Merchant Panel" },
      { property: "og:description", content: "Connect Messenger AI and WhatsApp AI for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HubPage,
});

const LOGOS = { messenger: MessengerMark, whatsapp: WhatsAppMark, webchat: WebChatMark } as const;

function HubPage() {
  const { connected, isLoading } = useAiMessagingConnections();
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">AI Messaging Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect an app to get its own menu in the sidebar. Each app is managed separately.
        </p>
      </div>
      <div className="grid gap-3">
        {AI_MESSAGING_APPS.map((p) => {
          const Logo = LOGOS[p.id];
          const on = !!connected[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <Logo size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <StatusBadge kind={on ? "connected" : "not_configured"} label={isLoading ? "…" : on ? (p.id === "webchat" ? "On" : "Connected") : (p.id === "webchat" ? "Off" : "Not connected")} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
              </div>
              <Button asChild size="sm" variant={on ? "outline" : "default"}>
                <Link to={p.integrationPath}>{on ? "Manage" : "Connect"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
