// Connection form for ONE courier (same CourierCard + server functions as the
// old Courier Integration page). Saves the whole couriers object as before so
// other couriers' settings are preserved untouched.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyStore, updateCouriers, testCourierConnection, syncCourierInfo } from "@/lib/admin.functions";
import { CourierCard } from "./CourierCard";
import { COURIERS, emptyConfig, type CourierConfig, type CourierKey } from "./providers";
import { useCourierBrandAssets } from "@/lib/courier-apps";

type FormState = Record<CourierKey, CourierConfig>;

export function CourierIntegration({ only }: { only: CourierKey }) {
  const fetchStore = useServerFn(getMyStore);
  const saveFn = useServerFn(updateCouriers);
  const testFn = useServerFn(testCourierConnection);
  const syncFn = useServerFn(syncCourierInfo);
  const qc = useQueryClient();
  const { logo, wordmark } = useCourierBrandAssets();
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "sync" | null>(null);

  useEffect(() => {
    if (!store) return;
    const c = (store as any).couriers ?? {};
    const next = {} as FormState;
    for (const m of COURIERS) next[m.key] = { ...emptyConfig, ...(c[m.key] ?? {}) };
    setForm(next);
  }, [store]);

  const meta = COURIERS.find((m) => m.key === only);
  if (!meta) return null;
  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "store"] });

  async function run(kind: "save" | "test" | "sync", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const save = () => run("save", async () => { await saveFn({ data: form }); refresh(); });
  const test = () => run("test", async () => {
    await saveFn({ data: form });
    const res = await testFn({ data: { key: only } });
    if (res.ok) toast.success(`${meta.label}: ${res.message} · ${res.latencyMs}ms`);
    else toast.error(`${meta.label}: ${res.message}`);
    refresh();
  });
  const sync = () => run("sync", async () => {
    await saveFn({ data: form });
    const res = await syncFn({ data: { key: only } });
    if (res.ok) toast.success(`${meta.label}: ${res.message}${res.summary ? ` · ${res.summary}` : ""}`);
    else toast.error(`${meta.label}: ${res.message}`);
    refresh();
  });
  const disconnect = () => run("save", async () => {
    const next: FormState = { ...form, [only]: { ...emptyConfig, credentials: {}, shipping: { ...(form[only].shipping ?? {}) } } };
    setForm(next);
    await saveFn({ data: next });
    refresh();
  });
  const setDefault = () =>
    setForm((f) => {
      if (!f) return f;
      const out = { ...f };
      (Object.keys(out) as CourierKey[]).forEach((k) => { out[k] = { ...out[k], is_default: k === only }; });
      return out;
    });

  return (
    <CourierCard
      meta={meta}
      value={form[only]}
      onChange={(next) => setForm((f) => (f ? { ...f, [only]: next } : f))}
      onSave={save}
      onTest={test}
      onSync={meta.supports.sync ? sync : undefined}
      onDisconnect={meta.profile === "simple" ? disconnect : undefined}
      onSetDefault={setDefault}
      saving={busy === "save"}
      testing={busy === "test"}
      syncing={busy === "sync"}
      logoUrl={logo[meta.key] ?? null}
      wordmarkUrl={wordmark[meta.key] ?? null}
    />
  );
}
