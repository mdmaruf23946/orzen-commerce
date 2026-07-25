import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { getMyStore, updateCouriers, testCourierConnection, listPublicCourierProviders } from "@/lib/admin.functions";
import { CourierCard } from "@/components/admin/couriers/CourierCard";
import {
  COURIERS,
  emptyConfig,
  type CourierConfig,
  type CourierKey,
} from "@/components/admin/couriers/providers";

export const Route = createFileRoute("/_authenticated/admin/couriers")({
  component: () => (
    <FeatureGate feature="courier">
      <CouriersPage />
    </FeatureGate>
  ),
});

type FormState = Record<CourierKey, CourierConfig>;

const defaultForm: FormState = {
  steadfast: { ...emptyConfig },
  pathao: { ...emptyConfig },
  redx: { ...emptyConfig },
  paperfly: { ...emptyConfig },
};

function CouriersPage() {
  const fetchStore = useServerFn(getMyStore);
  const saveFn = useServerFn(updateCouriers);
  const testFn = useServerFn(testCourierConnection);
  const fetchProviders = useServerFn(listPublicCourierProviders);
  const qc = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["admin", "store"],
    queryFn: () => fetchStore(),
  });

  const { data: providers } = useQuery({
    queryKey: ["courier-providers-public"],
    queryFn: () => fetchProviders(),
    staleTime: 5 * 60 * 1000,
  });

  const logoByCode: Record<string, string | null> = {};
  for (const p of (providers ?? []) as Array<{ code: string; logo_url: string | null }>) {
    logoByCode[p.code] = p.logo_url;
  }


  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState<CourierKey | null>(null);
  const [testing, setTesting] = useState<CourierKey | null>(null);

  useEffect(() => {
    if (!store) return;
    const c = (store as any).couriers ?? {};
    setForm({
      steadfast: { ...emptyConfig, ...(c.steadfast ?? {}) },
      pathao: { ...emptyConfig, ...(c.pathao ?? {}) },
      redx: { ...emptyConfig, ...(c.redx ?? {}) },
      paperfly: { ...emptyConfig, ...(c.paperfly ?? {}) },
    });
  }, [store]);

  if (!form) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  function updateOne(key: CourierKey, next: CourierConfig) {
    setForm((f) => (f ? { ...f, [key]: next } : f));
  }

  function setDefault(key: CourierKey) {
    setForm((f) => {
      if (!f) return f;
      const out = { ...f };
      (Object.keys(out) as CourierKey[]).forEach((k) => {
        out[k] = { ...out[k], is_default: k === key };
      });
      return out;
    });
  }

  async function save(key: CourierKey) {
    if (!form) return;
    setSaving(key);
    try {
      await saveFn({ data: form });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
    } finally {
      setSaving(null);
    }
  }

  async function test(key: CourierKey) {
    if (!form) return;
    // Persist any unsaved credentials first so the server test uses them.
    setTesting(key);
    try {
      await saveFn({ data: form });
      const res = await testFn({ data: { key } });
      if (res.ok) toast.success(`${key}: ${res.message} · ${res.latencyMs}ms`);
      else toast.error(`${key}: ${res.message}`);
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(null);
    }
  }

  const enabledCount = (Object.values(form) as CourierConfig[]).filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Courier Integration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect couriers to create parcels and sync delivery status. {enabledCount} enabled ·{" "}
          {COURIERS.length} available.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {COURIERS.map((meta) => (
          <CourierCard
            key={meta.key}
            meta={meta}
            value={form[meta.key]}
            onChange={(next) => updateOne(meta.key, next)}
            onSave={() => save(meta.key)}
            onTest={() => test(meta.key)}
            onSetDefault={() => setDefault(meta.key)}
            saving={saving === meta.key}
            testing={testing === meta.key}
            logoUrl={logoByCode[meta.key] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
