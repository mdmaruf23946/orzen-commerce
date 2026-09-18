import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import {
  listEmailAutomations,
  setEmailAutomation,
  sendTestPlatformEmail,
} from "@/lib/platform-notify.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/communication/automations")({
  component: EmailAutomationsPage,
  head: () => ({
    meta: [
      { title: "Email Automations — ORZEN Owner" },
      { name: "description", content: "Control which automatic emails ORZEN sends to merchants." },
      { property: "og:title", content: "Email Automations — ORZEN Owner" },
      {
        property: "og:description",
        content: "Control which automatic emails ORZEN sends to merchants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EmailAutomationsPage() {
  const listFn = useServerFn(listEmailAutomations);
  const setFn = useServerFn(setEmailAutomation);
  const testFn = useServerFn(sendTestPlatformEmail);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["owner", "email-automations"],
    queryFn: () => listFn(),
  });

  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["owner", "email-automations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: undefined as never }),
    onSuccess: (r: { to: string }) => toast.success(`Test email sent to ${r.to}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Email Automations"
        description="Automatic emails sent from notify@orzen.top. Turn any of them on or off."
        actions={
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
            <Send className="mr-2 h-4 w-4" />
            {test.isPending ? "Sending…" : "Send test email"}
          </Button>
        }
      />

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !data?.items?.length ? (
          <div className="p-6 text-sm text-muted-foreground">No automations found.</div>
        ) : (
          <ul className="divide-y">
            {data.items.map((a: any) => (
              <li key={a.key} className="flex items-start gap-4 p-4">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.label}</div>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
                <Switch
                  checked={a.enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ key: a.key, enabled: v })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
