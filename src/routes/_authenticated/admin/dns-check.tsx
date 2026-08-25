import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Radar, AlertTriangle } from "lucide-react";
import { checkDnsResolution } from "@/lib/domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/dns-check")({
  component: Page,
  head: () => ({
    meta: [
      { title: "DNS Checker — ORZEN Merchant Panel" },
      { name: "description", content: "Verify DNS records for your store domain." },
      { property: "og:title", content: "DNS Checker — ORZEN Merchant Panel" },
      { property: "og:description", content: "Verify DNS records for your store domain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
      <div className="flex items-start gap-2">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
        )}
        <div>
          <div className="text-sm font-medium">{label}</div>
          {detail && <div className="text-xs text-muted-foreground break-all">{detail}</div>}
        </div>
      </div>
      <span className={`text-xs font-medium ${ok ? "text-emerald-600" : "text-red-600"}`}>
        {ok ? "OK" : "Fail"}
      </span>
    </div>
  );
}

function Page() {
  const checkFn = useServerFn(checkDnsResolution);
  const [host, setHost] = useState("");
  const m = useMutation({
    mutationFn: (hostname?: string) => checkFn({ data: { hostname } }),
  });
  const r = m.data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">DNS Configuration Checker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify that your store subdomain and wildcard DNS are correctly pointing to the platform.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Run a check</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Leave empty to check your store subdomain"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => m.mutate(host || undefined)} disabled={m.isPending}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${m.isPending ? "animate-spin" : ""}`} />
            {m.isPending ? "Checking…" : "Check DNS"}
          </Button>
        </div>
        {m.error && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {(m.error as Error).message}
          </div>
        )}
      </section>

      {r && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Checked host</div>
              <code className="text-sm font-medium">{r.host}</code>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.checkedAt).toLocaleString()}
            </div>
          </div>

          <div className="grid gap-2">
            <StatusRow
              ok={r.hostResolves}
              label="Hostname resolves"
              detail={
                r.records.a.length
                  ? `A → ${r.records.a.join(", ")}`
                  : r.records.cname.length
                    ? `CNAME → ${r.records.cname.join(", ")}`
                    : "No A / CNAME records found"
              }
            />
            <StatusRow
              ok={r.pointsToPlatform}
              label={`Points to platform (${r.expectedIp})`}
              detail={
                r.records.a.length
                  ? `A records: ${r.records.a.join(", ")}`
                  : "No A record returned"
              }
            />
            <StatusRow
              ok={r.wildcardCorrect}
              label={`Wildcard *.${r.rootDomain} configured`}
              detail={
                r.records.wildcardProbe.length
                  ? `Random subdomain → ${r.records.wildcardProbe.join(", ")}`
                  : "Random subdomain does not resolve — add a wildcard A record"
              }
            />
            <StatusRow
              ok={r.records.rootA.includes(r.expectedIp)}
              label={`Root domain ${r.rootDomain}`}
              detail={r.records.rootA.length ? `A → ${r.records.rootA.join(", ")}` : "No A record"}
            />
            <StatusRow
              ok={r.records.dnsTargetA.length > 0}
              label={`Custom-domain CNAME target ${r.dnsTarget}`}
              detail={
                r.records.dnsTargetA.length
                  ? `A → ${r.records.dnsTargetA.join(", ")}`
                  : "Not resolving"
              }
            />
          </div>

          {!r.wildcardCorrect && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold">Wildcard DNS not configured</div>
                <div>
                  Add a wildcard <code>A</code> record at your DNS provider:
                  <br />
                  <code>*.{r.rootDomain} → {r.expectedIp}</code>
                </div>
                <div>
                  Then connect <code>*.{r.rootDomain}</code> in the platform's Domain settings.
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
