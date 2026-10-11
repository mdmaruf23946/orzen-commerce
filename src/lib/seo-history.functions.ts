// SEO change detection + rollback (Step 2). Hashing/snapshots happen in DB
// triggers; these functions only read history and trigger a rollback.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";

export const listSeoHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const store = await myStoreRow(sb, context.userId, "id", "seo");
    if (!store) throw new Error("No store found");
    const sid = (store as any).id as string;
    const [{ data: history }, { count: pending }] = await Promise.all([
      sb
        .from("seo_history_rollback")
        .select("id, entity_type, entity_id, metadata_before, metadata_after, change_source, rolled_back_at, created_at")
        .eq("store_id", sid)
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("seo_change_tracking")
        .select("id", { count: "exact", head: true })
        .eq("store_id", sid)
        .eq("status", "pending_review"),
    ]);
    const productIds = [...new Set((history ?? []).filter((h: any) => h.entity_type === "product").map((h: any) => h.entity_id))];
    let names: Record<string, string> = {};
    if (productIds.length) {
      const { data: ps } = await sb.from("products").select("id, name").in("id", productIds);
      names = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.name]));
    }
    return {
      pendingReview: pending ?? 0,
      history: (history ?? []).map((h: any) => ({
        ...h,
        label: h.entity_type === "store" ? "Store SEO" : names[h.entity_id] ?? "Product",
      })),
    };
  });

export const rollbackSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("seo_rollback", { _snapshot: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
