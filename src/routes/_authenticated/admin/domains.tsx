import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Globe,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  listMyDomains,
  addCustomDomain,
  checkDomainVerification,
  removeDomain,
  setPrimaryDomain,
  updateMySubdomain,
  checkSubdomainAvailable,
  checkDnsResolution,
  provisionMySubdomain,
} from "@/lib/domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGate } from "@/components/admin/FeatureGate";

export const Route = createFileRoute("/_authenticated/admin/domains")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Domains — ORZEN Merchant Panel" },
      { name: "description", content: "Manage your store subdomain and custom domains." },
      { property: "og:title", content: "Domains — ORZEN Merchant Panel" },
      { property: "og:description", content: "Manage your store subdomain and custom domains." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  verified: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending DNS",
  verified: "Verified (DNS OK)",
  active: "Active",
  failed: "Failed",
  released: "Disconnected",
};

/** Live state combines the DNS status with the certificate status. */
function domainState(d: any): { key: string; label: string } {
  if (d.status === "active") return { key: "active", label: "Active" };
  if (d.status === "verified") {
    if (d.ssl_status === "issuing") return { key: "verified", label: "Issuing SSL" };
    if (d.ssl_status === "issued") return { key: "active", label: "Active" };
    return { key: "verified", label: "Verified (DNS OK)" };
  }
  return { key: d.status, label: STATUS_LABEL[d.status] ?? d.status };
}

function StatusPill({ d }: { d: any }) {
  const st = domainState(d);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[st.key] ?? "bg-muted"}`}
    >
      {st.label}
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

function RecordRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="rounded border bg-background p-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
          {type}
        </span>
        <code className="min-w-0 flex-1 truncate text-xs">{name}</code>
        <CopyBtn v={name} />
      </div>
      <div className="mt-1 flex items-center gap-2 pl-1">
        <span className="text-[10px] uppercase text-muted-foreground">value</span>
        <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
        <CopyBtn v={value} />
      </div>
    </div>
  );
}

function isApexHost(h: string) {
  return h.split(".").filter(Boolean).length <= 2;
}

function Page() {
  const listFn = useServerFn(listMyDomains);
  const addFn = useServerFn(addCustomDomain);
  const checkFn = useServerFn(checkDomainVerification);
  const removeFn = useServerFn(removeDomain);
  const primaryFn = useServerFn(setPrimaryDomain);
  const saveSlugFn = useServerFn(updateMySubdomain);
  const slugCheckFn = useServerFn(checkSubdomainAvailable);
  const dnsFn = useServerFn(checkDnsResolution);
  const provisionFn = useServerFn(provisionMySubdomain);
  const [provisioning, setProvisioning] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "domains"],
    queryFn: () => listFn(),
  });

  // Subdomain reachability probe — warns when the platform wildcard is missing.
  const { data: dns } = useQuery({
    queryKey: ["admin", "domains", "subdomain-dns"],
    queryFn: () => dnsFn({ data: {} }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pendingDomains = (data?.domains ?? []).filter((d: any) => d.status !== "active");

  // Tick for the cooldown countdown while something is still pending.
  useEffect(() => {
    if (pendingDomains.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pendingDomains.length]);

  // Silent auto-refresh every 20s while a domain is not live yet.
  const pendingIds = pendingDomains.map((d: any) => d.id).join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const ids = pendingIds.split(",");
    const t = setInterval(async () => {
      for (const id of ids) {
        try {
          await checkFn({ data: { domainId: id } });
        } catch {
          // rate limit / transient — ignore, the next tick retries
        }
      }
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    }, 20_000);
    return () => clearInterval(t);
  }, [pendingIds, checkFn, qc]);

  // Subdomain editor
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState<{
    loading: boolean;
    ok: boolean | null;
    reason: string;
  }>({
    loading: false,
    ok: null,
    reason: "",
  });
  const [savingSlug, setSavingSlug] = useState(false);

  useEffect(() => {
    if (data?.store?.slug) setSlug((s) => s || data.store.slug);
  }, [data?.store?.slug]);

  const currentSlug = data?.store?.slug ?? "";
  useEffect(() => {
    if (!slug || slug === currentSlug) {
      setSlugState({ loading: false, ok: null, reason: "" });
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
      setSlugState({
        loading: false,
        ok: false,
        reason: "3+ chars, lowercase letters, numbers, hyphens",
      });
      return;
    }
    let alive = true;
    setSlugState({ loading: true, ok: null, reason: "" });
    const t = setTimeout(async () => {
      try {
        const r = await slugCheckFn({ data: { slug } });
        if (alive) setSlugState({ loading: false, ok: r.available, reason: r.reason });
      } catch (e) {
        if (alive) setSlugState({ loading: false, ok: false, reason: (e as Error).message });
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slug, currentSlug, slugCheckFn]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
        <h2 className="mt-3 font-semibold">Domain তথ্য লোড হয়নি</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error | null)?.message || "সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।"}
        </p>
        <Button className="mt-4" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          আবার চেষ্টা করুন
        </Button>
      </div>
    );
  }

  const settings = data.settings;
  const rootDomain = settings.rootDomain;
  const subdomainUrl = `https://${data.store.slug}.${rootDomain}`;

  async function reconnectSubdomain() {
    setProvisioning(true);
    try {
      const r = await provisionFn();
      if (r.ok) {
        toast.success(
          r.status && r.status !== "active"
            ? "Subdomain connected — Cloudflare is issuing the certificate (a few minutes)."
            : "Subdomain is connected and live.",
        );
      } else if (r.reason === "not_configured") {
        toast.error("Automatic subdomain setup is not configured on the platform yet.");
      } else {
        toast.error(r.error ?? "Could not connect the subdomain");
      }
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProvisioning(false);
    }
  }

  async function saveSlug() {
    setSavingSlug(true);
    try {
      const r = await saveSlugFn({ data: { slug } });
      toast.success(r.changed ? `Subdomain updated to ${r.slug}.${rootDomain}` : "No changes");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSlug(false);
    }
  }

  async function add() {
    setBusy(true);
    try {
      await addFn({ data: { hostname: host } });
      setHost("");
      toast.success("Domain added — add the DNS records below, then click Check now");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function check(id: string) {
    setChecking(id);
    try {
      const r = await checkFn({ data: { domainId: id } });
      if (r.ok) toast.success("Verified! SSL will be issued shortly.");
      else toast.error(r.reason || "Still pending");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(null);
    }
  }

  async function remove(id: string, wasPrimary = false) {
    if (!confirm("Remove this domain?")) return;
    try {
      await removeFn({ data: { domainId: id } });
      toast.success(
        wasPrimary ? "Domain removed — your store now uses its subdomain again" : "Domain removed",
      );
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
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
          Your store is always reachable at this free address. Changing it breaks old links.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center rounded-md border bg-background">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
              className="border-0 focus-visible:ring-0"
              placeholder="mystore"
            />
            <span className="shrink-0 px-3 text-sm text-muted-foreground">.{rootDomain}</span>
          </div>
          <Button
            onClick={saveSlug}
            disabled={
              savingSlug || slug === currentSlug || slugState.ok === false || slugState.loading
            }
          >
            {savingSlug ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
        <div className="min-h-4 text-xs">
          {slugState.loading && (
            <span className="text-muted-foreground">Checking availability…</span>
          )}
          {slugState.ok === true && <span className="text-emerald-600 dark:text-emerald-400">Available</span>}
          {slugState.ok === false && <span className="text-destructive">{slugState.reason}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <a
            href={subdomainUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-1 truncate text-sm underline"
          >
            <span className="truncate">{subdomainUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <CopyBtn v={subdomainUrl} />
        </div>

        {(data as any).autoSubdomain && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={reconnectSubdomain}
              disabled={provisioning}
            >
              {provisioning ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Reconnect subdomain
            </Button>
            <span className="text-xs text-muted-foreground">
              Re-links this address with the hosting network if it is not loading.
            </span>
          </div>
        )}

        {(data as any).store?.subdomain_released_at && (
          <div className="flex items-start gap-2 rounded-md bg-muted/60 p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              {(data as any).store.subdomain_release_reason === "custom_domain_live"
                ? "আপনার কাস্টম ডোমেইন লাইভ হওয়ায় এই ফ্রি সাবডোমেইনটি হোস্টিং থেকে সরিয়ে নেওয়া হয়েছে। দরকার হলে “Reconnect subdomain” চাপুন।"
                : "এই সাবডোমেইনটি বর্তমানে হোস্টিং থেকে সরানো আছে। “Reconnect subdomain” চাপলে আবার চালু হবে।"}
            </span>
          </div>
        )}

        {dns && !dns.hostResolves && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-sm text-amber-900 dark:text-amber-200 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              এই সাবডোমেইনটি এখনো লাইভ হয়নি। উপরের “Reconnect subdomain” চাপুন — প্ল্যাটফর্মে
              Cloudflare API সেটআপ থাকলে এটি সাথে সাথে DNS + হোস্টিং-এ যুক্ত হয়ে যাবে (সার্টিফিকেট
              ইস্যু হতে কয়েক মিনিট লাগতে পারে)।
            </span>
          </div>
        )}
      </section>

      {/* Custom domains (plan-gated) */}
      <FeatureGate feature={"custom_domain" as any} inline>
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Custom Domains</h2>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {data.autoSsl ? "Automatic SSL enabled" : "Manual SSL"}
            </span>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <p className="font-semibold">কীভাবে কানেক্ট করবেন — ৪ ধাপ:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>যেকোনো registrar (GoDaddy, Namecheap, Cloudflare) থেকে ডোমেইন কিনুন।</li>
              <li>
                নিচে ডোমেইন যোগ করে দেখানো TXT + A/CNAME record গুলো registrar এর DNS panel এ বসান।
              </li>
              <li>
                "Check now" চাপুন — verify হলে status "Verified" হবে (DNS ছড়াতে ৫ মিনিট–২৪ ঘণ্টা
                লাগতে পারে)।
              </li>
              <li>SSL issue হওয়ার পর "Make primary" দিয়ে সেট করলে ওই ডোমেইনে স্টোর ওপেন হবে।</li>
            </ol>
            <p className="mt-2">
              এখানে যত খুশি custom domain যোগ করা যাবে। Verify হওয়া domain গুলো Landing Pages এর
              Domains ট্যাব থেকে search করে যেকোনো landing page এর সাথে connect করা যাবে।
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="mystore.com or shop.mystore.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="flex-1"
            />
            <Button onClick={add} disabled={busy || !host}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Add domain
            </Button>
          </div>

          <div className="space-y-3">
            {data.domains.length === 0 && (
              <p className="text-xs text-muted-foreground">No custom domains yet.</p>
            )}
            {data.domains.map((d: any) => {
              const apex = isApexHost(d.hostname);
              const target = d.dns_target || settings.dnsTarget;
              const cooldownLeft = d.last_checked_at
                ? Math.max(
                    0,
                    Math.ceil((15_000 - (now - new Date(d.last_checked_at).getTime())) / 1000),
                  )
                : 0;
              const live = d.status === "active" || d.ssl_status === "issued";
              const canBePrimary =
                !d.landing_page_id &&
                (data.autoSsl ? live : d.status === "verified" || d.status === "active");

              return (
                <div key={d.id} className="space-y-3 rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="mr-auto min-w-0 truncate font-medium">{d.hostname}</code>
                    <StatusPill d={d} />
                    {d.ssl_status && d.ssl_status !== "none" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        SSL: {d.ssl_status}
                      </span>
                    )}
                    {primaryId === d.id && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Primary
                      </span>
                    )}
                    {d.landing_page && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                        Landing page: {d.landing_page.title || d.landing_page.slug}
                      </span>
                    )}
                  </div>

                  {d.status === "verified" && !live && (
                    <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                      DNS ঠিক আছে — এখন SSL সার্টিফিকেট ইস্যু হওয়ার অপেক্ষা।
                      {data.autoSsl
                        ? " সাধারণত ৫–১৫ মিনিট লাগে; এই পেজ নিজে নিজেই আপডেট হবে।"
                        : " এই প্ল্যাটফর্মে অটোমেটিক SSL এখনো চালু নেই, তাই সার্টিফিকেট ইস্যু না হওয়া পর্যন্ত ব্রাউজারে নিরাপত্তা সতর্কতা দেখাতে পারে — প্ল্যাটফর্ম অ্যাডমিনকে জানান।"}
                    </div>
                  )}

                  {d.last_error && d.status !== "active" && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 p-2 text-sm text-amber-900 dark:text-amber-200 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 break-words">{d.last_error}</span>
                    </div>
                  )}

                  {d.status !== "active" && (
                    <div className="space-y-2 rounded-md bg-muted/40 p-3 text-xs">
                      <div className="font-medium">Add these DNS records at your registrar:</div>
                      <RecordRow
                        type="TXT"
                        name={`_orzen-verify.${d.hostname}`}
                        value={d.verification_token}
                      />
                      {apex ? (
                        <>
                          <RecordRow type="A" name={d.hostname} value={settings.apexIp} />
                          <p className="text-[11px] text-muted-foreground">
                            আপনার DNS provider যদি CNAME flattening সাপোর্ট করে (যেমন Cloudflare),
                            তাহলে A এর বদলে{" "}
                            <code>
                              {d.hostname} → {target}
                            </code>{" "}
                            CNAME ও ব্যবহার করা যাবে।
                          </p>
                        </>
                      ) : (
                        <RecordRow type="CNAME" name={d.hostname} value={target} />
                      )}
                      {d.cf_ownership?.name && d.cf_ownership?.value && (
                        <RecordRow
                          type="TXT"
                          name={d.cf_ownership.name}
                          value={d.cf_ownership.value}
                        />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checking === d.id || cooldownLeft > 0}
                      onClick={() => check(d.id)}
                    >
                      {checking === d.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      )}
                      {cooldownLeft > 0 ? `Check now (${cooldownLeft}s)` : "Check now"}
                    </Button>
                    {primaryId !== d.id && canBePrimary && (
                      <Button size="sm" onClick={() => setPrimary(d.id)}>
                        Make primary
                      </Button>
                    )}
                    {primaryId !== d.id && !canBePrimary && (
                      <span className="self-center text-[11px] text-muted-foreground">
                        SSL ইস্যু হওয়ার পর primary করা যাবে
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(d.id, primaryId === d.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>

                  {d.last_checked_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Last checked: {new Date(d.last_checked_at).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Primary domain */}
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Primary Domain</h2>
          <p className="text-xs text-muted-foreground">
            The primary domain is used for canonical URLs and outbound links. Others redirect to it.
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
            <input type="radio" checked={!primaryId} onChange={() => setPrimary(null)} />
            <span className="truncate">
              Subdomain — <code className="text-xs">{subdomainUrl}</code>
            </span>
          </label>
          {data.domains
            .filter((d: any) => d.status === "verified" || d.status === "active")
            .map((d: any) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
              >
                <input
                  type="radio"
                  checked={primaryId === d.id}
                  onChange={() => setPrimary(d.id)}
                />
                <span className="truncate">
                  Custom — <code className="text-xs">{d.hostname}</code>
                </span>
              </label>
            ))}
        </section>
      </FeatureGate>
    </div>
  );
}
