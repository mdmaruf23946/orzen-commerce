import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Mail, RefreshCw } from "lucide-react";
import { getGmailStatus, sendGmailTest } from "@/lib/communication.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/owner/communication/gmail")({
  component: GmailPage,
});

function GmailPage() {
  const status = useServerFn(getGmailStatus);
  const test = useServerFn(sendGmailTest);
  const { data: s, refetch, isFetching } = useQuery({
    queryKey: ["gmail-status"], queryFn: () => status(),
  });
  const [to, setTo] = useState("");
  const [testing, setTesting] = useState(false);

  async function runTest() {
    if (!to) return toast.error("Enter a test recipient email");
    setTesting(true);
    try {
      await test({ data: { to } });
      toast.success("Test email sent");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Gmail Connection</div>
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

        {!s?.hasKey && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Gmail is not yet linked to this project. Ask your workspace admin to connect the
            <span className="font-medium"> Google Mail </span> connector under project settings.
            Once linked, refresh this page and the connection appears here automatically.
          </div>
        )}

        {s?.connected && (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Sender: <span className="font-medium">{s.email}</span></span>
            </div>
            {s.state?.last_tested_at && (
              <div className="text-xs text-muted-foreground">
                Last tested {new Date(s.state.last_tested_at).toLocaleString()} —{" "}
                {s.state.last_test_ok ? "OK" : `Failed: ${s.state.last_test_error ?? ""}`}
              </div>
            )}
          </div>
        )}

        {s?.error && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {s.error}
          </div>
        )}

        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh status
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 font-semibold">Send a test email</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Recipient email</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
          </div>
          <Button onClick={runTest} disabled={testing || !s?.connected}>
            {testing ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>
    </div>
  );
}
