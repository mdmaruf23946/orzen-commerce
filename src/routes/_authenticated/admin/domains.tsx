import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, RefreshCw, Trash2, Globe, ShieldCheck } from "lucide-react";
import {
  listMyDomains,
  addCustomDomain,
  checkDomainVerification,
  removeDomain,
  setPrimaryDomain,
} from "@/lib/domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGate } from "@/components/admin/FeatureGate";

export const Route = createFileRoute("/_authenticated/admin/domains")({ component: Page });

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  verified: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

function StatusPill({ s }: { s: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[s] ?? "bg-muted"}`}>
      {s}
    </span>
  );
}

function CopyBtn({ v }: { v: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(v);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Page() {
  const listFn = useServerFn(listMyDomains);
  const addFn = useServerFn(addCustomDomain);
  const checkFn = useServerFn(checkDomainVerification);
  const removeFn = useServerFn(removeDomain);
  const primaryFn = useServerFn(setPrimaryDomain);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "domains"], queryFn: () => listFn() });
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const rootDomain = "orzen.top";
  const subdomainUrl = `https://${data.store.slug}.${rootDomain}`;

  async function add() {
    setBusy(true);
    try {
      await addFn({ data: { hostname: host } });
      setHost("");
      toast.success("Domain added — configure DNS to verify");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function check(id: string) {
    try {
      const r = await checkFn({ data: { domainId: id } });
      if (r.ok) toast.success("Verified! SSL will be issued shortly.");
      else toast.error(r.reason || "Still pending");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this domain?")) return;
    await removeFn({ data: { domainId: id } });
    qc.invalidateQueries({ queryKey: ["admin", "domains"] });
  }

  async function setPrimary(id: string | null) {
    try {
      await primaryFn({ data: { domainId: id } });
      toast.success("Primary domain updated");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const primaryId = data.store.primary_domain_id;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your store subdomain and connect your own custom domain.
        </p>
      </div>

      {/* Subdomain */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Store Subdomain</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Your store is always reachable at this address. Edit the slug in{" "}
          <a href="/admin/settings" className="underline">Store Settings</a>.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <code className="truncate text-sm">{subdomainUrl}</code>
          <CopyBtn v={subdomainUrl} />
        </div>
      </section>

      {/* Custom domains (plan-gated) */}
      <FeatureGate feature={"custom_domain" as any} inline>
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Custom Domains</h2>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <p className="font-semibold">কীভাবে কানেক্ট করবেন — ৪ ধাপ:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>যেকোনো registrar (GoDaddy, Namecheap, Cloudflare) থেকে ডোমেইন কিনুন।</li>
              <li>নিচে ডোমেইন যোগ করে দেখানো TXT + A/CNAME record গুলো registrar এর DNS panel এ বসান।</li>
              <li>"Check now" চাপুন — verify হলে status "Verified" হবে।</li>
              <li>SSL issue হওয়ার পর "Make primary" দিয়ে সেট করলে ওই ডোমেইনে স্টোর ওপেন হবে।</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="shop.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="flex-1"
            />
            <Button onClick={add} disabled={busy || !host}>Add domain</Button>
          </div>


          <div className="space-y-3">
            {data.domains.length === 0 && (
              <p className="text-xs text-muted-foreground">No custom domains yet.</p>
            )}
            {data.domains.map((d: any) => (
              <div key={d.id} className="space-y-3 rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="mr-auto font-medium">{d.hostname}</code>
                  <StatusPill s={d.status} />
                  {d.status === "verified" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                      SSL: {d.ssl_status}
                    </span>
                  )}
                  {primaryId === d.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Primary
                    </span>
                  )}
                </div>

                {d.status !== "active" && (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3 text-xs">
                    <div className="font-medium">Add these DNS records at your registrar:</div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">TXT</Label>
                      <div className="mt-1 flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                        <code className="truncate">_orzen-verify.{d.hostname} → {d.verification_token}</code>
                        <CopyBtn v={d.verification_token} />
                      </div>
                    </div>
                    {d.dns_target && (
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">CNAME</Label>
                        <div className="mt-1 flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                          <code className="truncate">{d.hostname} → {d.dns_target}</code>
                          <CopyBtn v={d.dns_target} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => check(d.id)}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Check now
                  </Button>
                  {(d.status === "verified" || d.status === "active") && primaryId !== d.id && (
                    <Button size="sm" onClick={() => setPrimary(d.id)}>Make primary</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Primary domain */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Primary Domain</h2>
          <p className="text-xs text-muted-foreground">
            The primary domain is used for canonical URLs and outbound links. Others redirect to it.
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
            <input
              type="radio"
              checked={!primaryId}
              onChange={() => setPrimary(null)}
            />
            <span className="truncate">Subdomain — <code className="text-xs">{subdomainUrl}</code></span>
          </label>
          {data.domains
            .filter((d: any) => d.status === "verified" || d.status === "active")
            .map((d: any) => (
              <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                <input
                  type="radio"
                  checked={primaryId === d.id}
                  onChange={() => setPrimary(d.id)}
                />
                <span className="truncate">Custom — <code className="text-xs">{d.hostname}</code></span>
              </label>
            ))}
        </section>
      </FeatureGate>
    </div>
  );
}
