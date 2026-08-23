import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ShieldOff, Trash2 } from "lucide-react";
import {
  listAiRecommendations,
  listAiBlacklist,
  addAiBlacklist,
  removeAiBlacklist,
} from "@/lib/ai-review.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/ai-recommendations")({
  head: () => ({
    meta: [
      { title: "AI Recommendations — ORZEN Store Admin" },
      { name: "description", content: "Review AI-generated product recommendations for your store." },
      { property: "og:title", content: "AI Recommendations — ORZEN Store Admin" },
      { property: "og:description", content: "Review AI-generated product recommendations for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <AiRecommendationsPage />
    </FeatureGate>
  ),
});

function AiRecommendationsPage() {
  const listFn = useServerFn(listAiRecommendations);
  const blFn = useServerFn(listAiBlacklist);
  const addFn = useServerFn(addAiBlacklist);
  const rmFn = useServerFn(removeAiBlacklist);
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});

  const { data: recs = [] } = useQuery({
    queryKey: ["ai", "recs"],
    queryFn: () => listFn({ data: { days: 14 } }),
  });
  const { data: blacklist = [] } = useQuery({
    queryKey: ["ai", "blacklist"],
    queryFn: () => blFn(),
  });

  const blockedIds = new Set((blacklist as any[]).map((b) => b.product_id));

  async function block(productId: string) {
    try {
      await addFn({ data: { product_id: productId, reason: reason[productId] || null } });
      qc.invalidateQueries({ queryKey: ["ai", "blacklist"] });
      setReason((r) => ({ ...r, [productId]: "" }));
      toast.success("Blacklisted");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function unblock(id: string) {
    await rmFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["ai", "blacklist"] });
    toast.success("Removed");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-6 w-6" /> AI Recommendations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review products the AI showed to customers, and block anything it should not suggest again.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Blacklisted products ({(blacklist as any[]).length})</h2>
        {(blacklist as any[]).length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No products blacklisted.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {(blacklist as any[]).map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {b.products?.primary_image_url && (
                    <img src={b.products.primary_image_url.startsWith("http") ? b.products.primary_image_url : `/api/img/${b.products.primary_image_url}`} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{b.products?.name ?? "—"}</p>
                  {b.reason && <p className="line-clamp-1 text-xs text-muted-foreground">{b.reason}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => unblock(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent AI recommendations (last 14 days)</h2>
        {(recs as any[]).length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No recommendations logged yet. Once the AI suggests products, they will appear here.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {(recs as any[]).map((r) => {
              const blocked = blockedIds.has(r.product_id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {r.products?.primary_image_url && (
                      <img src={r.products.primary_image_url.startsWith("http") ? r.products.primary_image_url : `/api/img/${r.products.primary_image_url}`} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{r.products?.name ?? "Deleted product"}</p>
                    <p className="text-xs text-muted-foreground">
                      ৳{Number(r.products?.price ?? 0).toFixed(0)} · stock {r.products?.stock ?? 0} · via {r.tool_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()} · {r.ai_conversations?.customer_name ?? "Unknown"} · "{r.context}"
                    </p>
                  </div>
                  {blocked ? (
                    <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">Blocked</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Reason (optional)"
                        value={reason[r.product_id] ?? ""}
                        onChange={(e) => setReason((s) => ({ ...s, [r.product_id]: e.target.value }))}
                        className="h-8 w-40 text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={() => block(r.product_id)}>
                        <ShieldOff className="mr-1 h-3 w-3" /> Block
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
