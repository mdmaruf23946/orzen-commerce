// Store-admin-facing: returns active ads for the caller's store (plan-gated in RPC).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActiveAd = { slot_key: string; code: string; format: string };

export const getMyActiveAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveAd[]> => {
    const { data, error } = await context.supabase.rpc("get_my_active_ads");
    if (error) return [];
    return (data as ActiveAd[]) ?? [];
  });
