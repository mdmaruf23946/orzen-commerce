import { FeatureGate } from "@/components/admin/FeatureGate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateSeo } from "@/lib/admin.functions";
import { getMySeoOverview } from "@/lib/seo.functions";
import { resolveStoreSeo, seoHealth, type StoreSeo } from "@/lib/seo";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { BasicTab } from "@/components/admin/seo/BasicTab";
import { SocialTab } from "@/components/admin/seo/SocialTab";
import { SearchTab } from "@/components/admin/seo/SearchTab";
import { VerificationTab } from "@/components/admin/seo/VerificationTab";
import { HistoryTab } from "@/components/admin/seo/HistoryTab";
import { AiOptimizerTab } from "@/components/admin/seo/AiOptimizerTab";
import { SeoHealth } from "@/components/admin/seo/SeoHealth";
import type { SeoOverview } from "@/components/admin/seo/shared";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: "SEO Settings — ORZEN Merchant Panel" },
      { name: "description", content: "Manage meta tags, sitemap and search visibility." },
      { property: "og:title", content: "SEO Settings — ORZEN Merchant Panel" },
      { property: "og:description", content: "Manage meta tags, sitemap and search visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="seo">
      <SeoPage />
    </FeatureGate>
  ),
});

const TABS = [
  { key: "ai", label: "AI Optimizer" },
  { key: "basic", label: "Basic" },
  { key: "social", label: "Social" },
  { key: "search", label: "Search" },
  { key: "verification", label: "Verification" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function SeoPage() {
  const fetchOverview = useServerFn(getMySeoOverview);
  const saveSeo = useServerFn(updateSeo);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("ai");
  const [form, setForm] = useState<StoreSeo | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "seo-overview"],
    queryFn: () => fetchOverview(),
  });

  useEffect(() => {
    if (data) setForm({ ...(((data as any).store?.seo ?? {}) as StoreSeo) });
  }, [data]);

  if (isLoading || !form || !data) {
    return <div className="p-1 text-sm text-muted-foreground">Loading…</div>;
  }

  const overview = data as unknown as SeoOverview;

  function set<K extends keyof StoreSeo>(k: K, v: StoreSeo[K]) {
    setForm((f) => ({ ...(f as StoreSeo), [k]: v }));
  }

  async function onSave(keys: (keyof StoreSeo)[]) {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const k of keys) payload[k as string] = (form as any)[k] ?? null;
      await saveSeo({ data: payload as any });
      await qc.invalidateQueries({ queryKey: ["admin", "seo-overview"] });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("SEO settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const resolved = resolveStoreSeo(
    { ...overview.store, seo: form },
    {
      origin: overview.storeUrl,
      categories: overview.categories,
      productCount: overview.productCount,
    },
  );
  const health = seoHealth({
    store: { ...overview.store, seo: form },
    resolved,
    productCount: overview.productCount,
  });

  const props = { form, set, overview, saving, onSave };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">SEO Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how your store appears on Google and social platforms. Empty fields fall back to
          automatic values.
        </p>
      </div>
      <TypeFilterTabs tabs={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} />
      {tab === "basic" && <BasicTab {...props} />}
      {tab === "social" && <SocialTab {...props} />}
      {tab === "search" && <SearchTab {...props} />}
      {tab === "verification" && <VerificationTab {...props} />}
      {tab === "history" && <HistoryTab />}
      {tab === "ai" && <AiOptimizerTab />}
      {tab !== "ai" && <SeoHealth items={health} />}
    </div>
  );
}
