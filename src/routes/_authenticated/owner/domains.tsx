import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/owner-ext.functions";
import { listAllDomains, setDomainSslStatus, ownerRemoveDomain, platformDomainHealth } from "@/lib/domains.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/domains")({ component: Page });

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-blue-100 text-blue-800",
  active: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

function HealthRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
        />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      {!ok && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Page() {

  const getS = useServerFn(getPlatformSettings);
  const saveS = useServerFn(updatePlatformSettings);
  const listAll = useServerFn(listAllDomains);
  const setSsl = useServerFn(setDomainSslStatus);
  const removeFn = useServerFn(ownerRemoveDomain);
  const qc = useQueryClient();

  const healthFn = useServerFn(platformDomainHealth);
  const { data: sData } = useQuery({ queryKey: ["owner", "sysSettings"], queryFn: () => getS() });
  const { data: domains } = useQuery({ queryKey: ["owner", "domains"], queryFn: () => listAll() });
  const { data: health, isFetching: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["owner", "domainHealth"],
    queryFn: () => healthFn(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sData && !f) {
      setF({
        root_domain: sData.root_domain ?? "orzen.top",
        login_host: sData.login_host ?? "admin.orzen.top",
        dns_target: sData.dns_target ?? "stores.orzen.top",
        wildcard_enabled: sData.wildcard_enabled ?? true,
        custom_domains_enabled: sData.custom_domains_enabled ?? true,
        ssl_provider: sData.ssl_provider ?? "Let's Encrypt",
      });
    }
  }, [sData]);

  async function save() {
    setSaving(true);
    try {
      await saveS({ data: { settings: { ...(sData as any), ...f } } });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["owner", "sysSettings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function markSsl(id: string, status: string, activate = false) {
    try {
      await setSsl({ data: { domainId: id, ssl_status: status as any, activate } });
      qc.invalidateQueries({ queryKey: ["owner", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this domain?")) return;
    await removeFn({ data: { domainId: id } });
    qc.invalidateQueries({ queryKey: ["owner", "domains"] });
  }

  return (
    <div>
      <OwnerPageHeader title="Domains & Routing" description="Root domain, login host, wildcard SSL, and every custom domain across all stores." />

      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Platform routing health</h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={healthLoading}
              onClick={() => refetchHealth()}
            >
              {healthLoading ? "Checking…" : "Re-check"}
            </Button>
          </div>
          {!health ? (
            <div className="text-sm text-muted-foreground">Checking DNS…</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <HealthRow
                ok={health.rootResolves}
                label={`Root domain ${health.rootDomain}`}
                hint="The platform site itself must resolve."
              />
              <HealthRow
                ok={health.wildcardResolves}
                label={`Wildcard *.${health.rootDomain}`}
                hint="Required for store subdomains. Add a wildcard custom hostname in Cloudflare."
              />
              <HealthRow
                ok={health.fallbackOriginResolves}
                label={`Fallback origin ${health.dnsTarget || "(not set)"}`}
                hint="Merchant custom domains CNAME here. Must exist and be proxied."
              />
              <HealthRow
                ok={health.cloudflareConfigured}
                label="Automatic SSL (CF_API_TOKEN + CF_ZONE_ID)"
                hint="Without these, merchant domains verify but never get a certificate."
              />
            </div>
          )}
        </section>


        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Global Settings</h2>
          {!f ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Root domain</Label>
                <Input value={f.root_domain} onChange={(e) => setF({ ...f, root_domain: e.target.value })} placeholder="orzen.top" />
                <p className="mt-1 text-xs text-muted-foreground">Stores get <code>&lt;slug&gt;.{f.root_domain}</code></p>
              </div>
              <div>
                <Label>System login host</Label>
                <Input value={f.login_host} onChange={(e) => setF({ ...f, login_host: e.target.value })} placeholder="admin.orzen.top" />
                <p className="mt-1 text-xs text-muted-foreground">Store admins log in here. Never changes per store.</p>
              </div>
              <div>
                <Label>Custom-domain CNAME target</Label>
                <Input value={f.dns_target} onChange={(e) => setF({ ...f, dns_target: e.target.value })} placeholder="stores.orzen.top" />
              </div>
              <div>
                <Label>SSL provider (label)</Label>
                <Input value={f.ssl_provider} onChange={(e) => setF({ ...f, ssl_provider: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={f.wildcard_enabled} onCheckedChange={(v) => setF({ ...f, wildcard_enabled: v })} />
                Wildcard SSL enabled (*.{f.root_domain})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={f.custom_domains_enabled} onCheckedChange={(v) => setF({ ...f, custom_domains_enabled: v })} />
                Allow custom domains globally
              </label>
              <div className="sm:col-span-2">
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">All Custom Domains</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="p-2">Hostname</th>
                  <th className="p-2">Store</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">SSL</th>
                  <th className="p-2">Last checked</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(domains ?? []).map((d: any) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2"><code>{d.hostname}</code></td>
                    <td className="p-2">{d.stores?.name ?? d.store_id}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[d.status] ?? "bg-muted"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-2 capitalize">{d.ssl_status}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {d.status === "verified" && d.ssl_status !== "issued" && (
                          <Button size="sm" variant="outline" onClick={() => markSsl(d.id, "issued", true)}>
                            Activate
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(d.id)}>
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(domains ?? []).length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">No custom domains yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
