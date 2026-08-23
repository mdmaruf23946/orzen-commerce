import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { listStoreAiCallCenters, setStoreAiCallFeature } from "@/lib/ai-call-center.functions";

export function StoresTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStoreAiCallCenters);
  const setFn = useServerFn(setStoreAiCallFeature);
  const { data } = useQuery({ queryKey: ["ai-call", "stores"], queryFn: () => listFn() });
  const [q, setQ] = useState("");

  const rows = ((data as any[]) ?? []).filter((s) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || s.slug?.toLowerCase().includes(q.toLowerCase()),
  );

  async function toggle(storeId: string, enabled: boolean) {
    try {
      await setFn({ data: { storeId, enabled } });
      await qc.invalidateQueries({ queryKey: ["ai-call", "stores"] });
      toast.success(enabled ? "AI Call Center enabled for this store" : "AI Call Center disabled");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update the store");
    }
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Store Access</h2>
        <Input className="h-9 sm:w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stores" />
      </div>
      <div className="divide-y">
        {rows.map((s) => (
          <div key={s.store_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.phone_number ?? "No number"} · {s.calls} calls · {s.minutes} min
                {s.is_active && <span className="ml-2 text-emerald-600">Live</span>}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              Enabled
              <Switch checked={s.feature_enabled} onCheckedChange={(v) => void toggle(s.store_id, v)} />
            </label>
          </div>
        ))}
        {!rows.length && <div className="p-6 text-sm text-muted-foreground">No stores found.</div>}
      </div>
    </div>
  );
}
