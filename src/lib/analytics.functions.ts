import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";
import { computeAnalytics } from "@/lib/analytics.server";

export const storeAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_type: z.enum(["physical", "digital", "service", "subscription"]).optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        compare_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        compare_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "analytics");
    const { data: store } = await context.supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!store?.id) return null;
    return computeAnalytics(context.supabase, store.id, data);
  });
