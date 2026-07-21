import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listLowStockAlerts, resolveLowStockAlert } from "@/lib/ai-review.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/low-stock")({
  component: LowStockPage,
});

function LowStockPage() {
  const listFn = useServerFn(listLowStockAlerts);
  const resolveFn = useServerFn(resolveLowStockAlert);
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: () => listFn(),
  });

  useEffect(() => {
    const channel = supabase
      .channel("low-stock-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "low_stock_alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["low-stock-alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  async function resolve(id: string) {
    try {
      await resolveFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["low-stock-alerts"] });
      toast.success("Resolved");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <AlertTriangle className="h-6 w-6 text-amber-500" /> Low Stock Alerts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Products at or below their low-stock threshold. The AI will avoid recommending them and suggest similar in-stock items instead.
        </p>
      </div>

      {(rows as any[]).length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          All products are well stocked ✅
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(rows as any[]).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                {a.products?.primary_image_url && (
                  <img src={a.products.primary_image_url.startsWith("http") ? a.products.primary_image_url : `/api/img/${a.products.primary_image_url}`} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{a.products?.name ?? "Deleted product"}</p>
                <p className="text-xs text-muted-foreground">
                  Stock <span className={a.current_stock === 0 ? "font-semibold text-destructive" : "font-semibold text-amber-600"}>{a.current_stock}</span>
                  {" "}· threshold {a.threshold} · alerted {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/products"
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Restock
                </Link>
                <Button size="sm" variant="outline" onClick={() => resolve(a.id)}>
                  <Check className="mr-1 h-3 w-3" /> Resolve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
