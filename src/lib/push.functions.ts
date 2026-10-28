import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subSchema = z.object({
  store_id: z.string().uuid(),
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(8).max(100),
  user_agent: z.string().max(300).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => subSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await (context.supabase as any).rpc("has_store_access", { _store_id: data.store_id });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("push_subscriptions").upsert(
      { ...data, user_id: context.userId, failures: 0 }, { onConflict: "endpoint" });
    if (error) throw new Error("Could not save device");
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ endpoint: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await (context.supabase as any).rpc("has_store_access", { _store_id: data.store_id });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("push_outbox").insert({
      store_id: data.store_id, kind: "order", title: "🔔 ORZEN নোটিফিকেশন চালু আছে",
      body: "নতুন অর্ডার ও মেসেজ এলে এভাবেই জানানো হবে।", url: "/admin", tag: "test",
    });
    const { dispatchPush } = await import("@/lib/push.server");
    return dispatchPush(5);
  });
