import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Send, Mail, Users, AlertTriangle } from "lucide-react";
import { getGmailStatus, listCommunicationHistory } from "@/lib/communication.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/communication/")({
  component: Dashboard,
});

function Dashboard() {
  const status = useServerFn(getGmailStatus);
  const history = useServerFn(listCommunicationHistory);
  const { data: s } = useQuery({ queryKey: ["gmail-status"], queryFn: () => status() });
  const { data: h = [] } = useQuery({ queryKey: ["comm-history"], queryFn: () => history({ data: { limit: 20 } }) });

  const totals = (h as any[]).reduce(
    (acc, c) => {
      const t = c.totals ?? {};
      acc.sent += Number(t.email_sent ?? 0);
      acc.failed += Number(t.email_failed ?? 0);
      acc.recipients += Number(t.recipients ?? 0);
      return acc;
    },
    { sent: 0, failed: 0, recipients: 0 },
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Gmail Connection</div>
          {s?.connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <XCircle className="h-3.5 w-3.5" /> Not connected
            </span>
          )}
        </div>
        {s?.connected ? (
          <div className="text-sm text-muted-foreground">
            Sending from <span className="font-medium text-foreground">{s.email}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Connect your personal Gmail to send platform emails from your own address.
            </p>
            <Link to="/owner/communication/gmail">
              <Button size="sm"><Mail className="mr-1 h-4 w-4" /> Connect Gmail</Button>
            </Link>
          </div>
        )}
        {s?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> <span>{s.error}</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Recipients (recent)" value={totals.recipients} />
        <Stat icon={Send} label="Emails sent" value={totals.sent} tone="ok" />
        <Stat icon={XCircle} label="Failed" value={totals.failed} tone="bad" />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Quick actions</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/owner/communication/compose"><Button size="sm"><Send className="mr-1 h-4 w-4" /> Compose new</Button></Link>
          <Link to="/owner/communication/history"><Button size="sm" variant="outline">View history</Button></Link>
          <Link to="/owner/communication/templates"><Button size="sm" variant="outline">Manage templates</Button></Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
