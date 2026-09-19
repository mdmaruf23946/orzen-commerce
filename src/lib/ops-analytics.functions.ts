import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";
import { computeCourierOverview, computePaymentOverview } from "@/lib/ops-analytics.server";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compare_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function myStoreId(supabase: any, userId: string) {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export const courierOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "analytics");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    return computeCourierOverview(context.supabase, sid, data);
  });

export const paymentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "analytics");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    return computePaymentOverview(context.supabase, sid, data);
  });
