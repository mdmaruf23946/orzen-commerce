import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getMyStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

/**
 * Generic settings page wrapper. Loads the store, exposes form state,
 * calls the supplied save server fn on submit.
 *
 *   <SettingsPage title="Marketing" column="marketing" save={updateMarketing}>
 *     {(form, set) => (...fields...)}
 *   </SettingsPage>
 */
export function SettingsPage<T extends Record<string, any>>({
  title,
  description,
  column,
  save,
  defaults,
  children,
}: {
  title: string;
  description?: string;
  column: string;
  save: any;
  defaults: T;
  children: (form: T, set: <K extends keyof T>(k: K, v: T[K]) => void) => ReactNode;
}) {
  const fetchStore = useServerFn(getMyStore);
  const saveFn = useServerFn(save);
  const qc = useQueryClient();
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const [form, setForm] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) setForm({ ...defaults, ...((store as any)[column] ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, column]);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  function set<K extends keyof T>(k: K, v: T[K]) {
    setForm((f) => ({ ...(f as T), [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveFn({ data: form });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("Saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-4">{children(form, set)}</div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
