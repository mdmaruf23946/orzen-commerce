import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyStore } from "@/lib/admin.functions";

/** Loads stores.marketing and keeps a local form for one platform namespace. */
export function useMarketingForm<T extends Record<string, any>>(
  namespace: string | null,
  defaults: T,
  saveFnRef: any,
) {
  const fetchStore = useServerFn(getMyStore);
  const save = useServerFn(saveFnRef);
  const qc = useQueryClient();
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const [form, setForm] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    const m: any = (store as any).marketing ?? {};
    const raw = namespace ? (m[namespace] ?? {}) : m;
    const picked: Record<string, any> = {};
    for (const k of Object.keys(defaults)) if (raw[k] !== undefined && raw[k] !== null) picked[k] = raw[k];
    setForm({ ...defaults, ...picked } as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, namespace]);

  function set<K extends keyof T>(k: K, v: T[K]) {
    setForm((f) => ({ ...(f as T), [k]: v }));
  }

  async function submit(onDone?: () => void) {
    if (!form) return;
    setSaving(true);
    try {
      await save({ data: form });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("Saved");
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return { form, set, saving, submit };
}
