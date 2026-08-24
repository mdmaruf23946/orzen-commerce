import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ShieldOff, Trash2, User, CalendarDays, Bot } from "lucide-react";
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

function imgSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

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
        <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Sparkles className="h-5 w-5 text-primary" /> AI Recommendations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review products the AI showed to customers, and block anything it should not suggest again.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold sm:text-lg">Blacklisted products ({(blacklist as any[]).length})</h2>
        {(blacklist as any[]).length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
            No products blacklisted.
          </div>
        ) : (
          <ul className="grid gap-3">
            {(blacklist as any[]).map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {b.products?.primary_image_url && (
                    <img src={imgSrc(b.products.primary_image_url) ?? undefined} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.products?.name ?? "—"}</p>
                  {b.reason ? (
                    <p className="truncate text-xs text-muted-foreground">{b.reason}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Blocked</p>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => unblock(b.id)} aria-label="Remove from blacklist">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold sm:text-lg">Recent AI recommendations (last 14 days)</h2>
        {(recs as any[]).length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
            No recommendations logged yet. Once the AI suggests products, they will appear here.
          </div>
        ) : (
          <ul className="grid gap-3">
            {(recs as any[]).map((r) => {
              const blocked = blockedIds.has(r.product_id);
              const product = r.products ?? {};
              const src = imgSrc(product.primary_image_url);
              return (
                <li key={r.id} className="rounded-xl border bg-card p-3">
                  {/* Top row: image + product info + blocked badge */}
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">{product.name ?? "Deleted product"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">৳{Number(product.price ?? 0).toFixed(0)}</span>
                        <span>·</span>
                        <span>Stock {product.stock ?? 0}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Bot className="h-3 w-3" /> {r.tool_name}
                        </span>
                      </div>
                    </div>
                    {blocked && (
                      <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        Blocked
                      </span>
                    )}
                  </div>

                  {/* Compact context + meta */}
                  <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2">
                    {r.context && (
                      <p className="line-clamp-2 text-xs italic text-foreground/80">“{r.context}”</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {r.ai_conversations?.customer_name ?? "Unknown"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatShortDate(r.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Action row */}
                  {!blocked && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Input
                        placeholder="Reason (optional)"
                        value={reason[r.product_id] ?? ""}
                        onChange={(e) => setReason((s) => ({ ...s, [r.product_id]: e.target.value }))}
                        className="h-9 flex-1 bg-background text-xs"
                      />
                      <Button size="sm" variant="outline" className="h-9 shrink-0 gap-1 text-xs" onClick={() => block(r.product_id)}>
                        <ShieldOff className="h-3.5 w-3.5" /> Block
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
