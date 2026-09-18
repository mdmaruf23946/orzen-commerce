import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Mail, Send, XCircle } from "lucide-react";
import { getEmailConfigStatus } from "@/lib/email-ops.functions";
import { sendTestPlatformEmail } from "@/lib/platform-notify.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/communication/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Email Settings — ORZEN Owner" },
      { name: "description", content: "Sender address, email provider connection and automation status for ORZEN." },
      { property: "og:title", content: "Email Settings — ORZEN Owner" },
      { property: "og:description", content: "Sender address, email provider connection and automation status for ORZEN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SettingsPage() {
  const cfgFn = useServerFn(getEmailConfigStatus);
  const testFn = useServerFn(sendTestPlatformEmail);
  const { data, isLoading } = useQuery({ queryKey: ["email-config"], queryFn: () => cfgFn() });

  const test = useMutation({
    mutationFn: () => testFn({ data: undefined as never }),
    onSuccess: (r: { to: string }) => toast.success(`Test email sent to ${r.to}`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const p = data?.provider;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Sending account</div>
          {p?.connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
              <XCircle className="h-3.5 w-3.5" /> Not connected
            </span>
          )}
        </div>
        <Row label="From name" value={data?.sender.name ?? "—"} />
        <Row label="From address" value={data?.sender.email ?? "—"} />
        <Row label="Provider account" value={p?.email ?? "—"} />
        <Row label="Plan" value={p?.planType ?? "—"} />
        <Row label="Email credits left" value={p?.credits != null ? String(p.credits) : "—"} />
        {p?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{p.error}</span>
          </div>
        )}
        <Button className="mt-4" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
          <Send className="mr-1 h-4 w-4" /> {test.isPending ? "Sending…" : "Send test email to me"}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4" /> Automatic emails
        </div>
        <div className="divide-y">
          {(data?.automations ?? []).map((a) => (
            <div key={a.key} className="flex items-center justify-between py-2 text-sm">
              <span>{a.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  a.enabled ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {a.enabled ? "On" : "Off"}
              </span>
            </div>
          ))}
          {(data?.automations?.length ?? 0) === 0 && (
            <div className="py-2 text-sm text-muted-foreground">No automations configured.</div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/owner/communication/automations">
            <Button size="sm" variant="outline">Change automation switches</Button>
          </Link>
          <Link to="/owner/communication/activity">
            <Button size="sm" variant="outline">View delivery activity</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
