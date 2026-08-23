import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { listStoreAiCallCenters } from "@/lib/ai-call-center.functions";

export function StoresTab() {
  const listFn = useServerFn(listStoreAiCallCenters);
  const { data } = useQuery({ queryKey: ["ai-call", "stores"], queryFn: () => listFn() });
  const [q, setQ] = useState("");

  const rows = ((data as any[]) ?? []).filter((s) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || s.slug?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">Store Access</h2>
          <p className="text-xs text-muted-foreground">
            Access is granted by the subscription plan. Enable “AI Call Center” on a plan to unlock it for its stores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input className="h-9 sm:w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stores" />
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link to="/owner/plan-features">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Plan Features
            </Link>
          </Button>
        </div>
      </div>
      <div className="divide-y">
        {rows.map((s) => (
          <div key={s.store_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.plan_name ?? "No plan"} · {s.phone_number ?? "No number"} · {s.calls} calls · {s.minutes} min
                {s.is_active && <span className="ml-2 text-emerald-600">Live</span>}
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                s.feature_enabled
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.feature_enabled ? "Included in plan" : "Not in plan"}
            </span>
          </div>
        ))}
        {!rows.length && <div className="p-6 text-sm text-muted-foreground">No stores found.</div>}
      </div>
    </div>
  );
}
