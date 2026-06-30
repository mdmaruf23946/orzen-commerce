// Billing / subscription server functions for store admins.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PUBLIC_FIELDS =
  "id,name,description,price,duration_days,billing_cycle,product_limit,order_limit,customer_limit,staff_limit,storage_mb,features,is_trial,trial_days,sort_order,plan_tier,feature_summary";

export const CYCLE_MONTHS = { monthly: 1, "3m": 3, "6m": 6, yearly: 12 } as const;
export type CycleKey = keyof typeof CYCLE_MONTHS;

export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("subscription_packages")
    .select(PUBLIC_FIELDS)
    .eq("is_active", true)
    .eq("is_trial", false)
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getBillingSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await (sb.from("platform_billing_settings" as any) as any)
    .select("discount_3m,discount_6m,discount_yearly")
    .eq("id", "global")
    .maybeSingle();
  return {
    discount_3m: Number(data?.discount_3m ?? 5),
    discount_6m: Number(data?.discount_6m ?? 10),
    discount_yearly: Number(data?.discount_yearly ?? 20),
  };
});

export function discountForCycle(
  cycle: CycleKey,
  settings: { discount_3m: number; discount_6m: number; discount_yearly: number },
): number {
  if (cycle === "3m") return settings.discount_3m;
  if (cycle === "6m") return settings.discount_6m;
  if (cycle === "yearly") return settings.discount_yearly;
  return 0;
}

export function computeCycleTotal(
  monthlyPrice: number,
  cycle: CycleKey,
  settings: { discount_3m: number; discount_6m: number; discount_yearly: number },
): { months: number; discountPct: number; total: number; perMonth: number; saved: number } {
  const months = CYCLE_MONTHS[cycle];
  const base = Number(monthlyPrice) * months;
  const discountPct = discountForCycle(cycle, settings);
  const total = Math.round(base * (1 - discountPct / 100));
  const perMonth = Math.round(total / months);
  const saved = Math.round(base - total);
  return { months, discountPct, total, perMonth, saved };
}

export const myBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Refresh first so expired trials auto-downgrade
    const { data: storePre } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (storePre?.id) {
      await (supabase as any).rpc("refresh_store_subscription_status", { _store_id: storePre.id });
    }

    const { data: storeRaw } = await supabase
      .from("stores")
      .select(
        "id,name,slug,status,subscription_status,trial_ends_at,expires_at,last_renewed_at,package_id,subscription_packages(" +
          PUBLIC_FIELDS +
          ")",
      )
      .eq("owner_user_id", userId)
      .maybeSingle();
    const store = storeRaw as any;
    if (!store) return { store: null, payments: [], notifications: [], days_left: 0 };

    const [{ data: payments }, { data: notifications }] = await Promise.all([
      supabase
        .from("payments")
        .select("id,amount,method,txn_id,status,invoice_no,created_at,cycle_start,cycle_end,package_id,subscription_packages(name,plan_tier)")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase.from("subscription_notifications" as any) as any)
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Days left until trial end (when trialing) or expires_at
    const trialing = store.subscription_status === "trialing";
    const target = trialing
      ? store.trial_ends_at
        ? new Date(store.trial_ends_at).getTime()
        : 0
      : store.expires_at
        ? new Date(store.expires_at).getTime()
        : 0;
    const days_left = target ? Math.max(0, Math.ceil((target - Date.now()) / 86400000)) : 0;

    return { store, payments: payments ?? [], notifications: notifications ?? [], days_left };
  });

export const submitManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        packageId: z.string().uuid(),
        cycle: z.enum(["monthly", "3m", "6m", "yearly"]).default("monthly"),
        method: z.enum(["bkash", "nagad", "rocket"]),
        txn_id: z.string().trim().min(3).max(80),
        sender_number: z.string().trim().min(5).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("Store not found");
    const { data: pkg } = await supabase
      .from("subscription_packages")
      .select("price,name")
      .eq("id", data.packageId)
      .maybeSingle();
    if (!pkg) throw new Error("Package not found");

    // Pull discounts server-side using the public client (settings are public)
    const sbPub = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: settings } = await (sbPub.from("platform_billing_settings" as any) as any)
      .select("discount_3m,discount_6m,discount_yearly")
      .eq("id", "global")
      .maybeSingle();
    const s = {
      discount_3m: Number(settings?.discount_3m ?? 5),
      discount_6m: Number(settings?.discount_6m ?? 10),
      discount_yearly: Number(settings?.discount_yearly ?? 20),
    };
    const { months, total } = computeCycleTotal(Number(pkg.price), data.cycle, s);

    const { data: payment, error } = await (supabase.from("payments") as any)
      .insert({
        store_id: store.id,
        package_id: data.packageId,
        amount: total,
        method: data.method,
        txn_id: data.txn_id,
        sender_number: data.sender_number,
        status: "pending",
        notes: `Cycle: ${data.cycle} (${months} mo). Awaiting verification.`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await (supabase.from("subscription_notifications" as any) as any).insert({
      store_id: store.id,
      type: "payment_pending",
      meta: { payment_id: payment.id, package: pkg.name, cycle: data.cycle, amount: total },
    });
    return { ok: true, paymentId: payment.id };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("subscription_notifications" as any) as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEnabledPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase.from("platform_payment_settings" as any) as any)
      .select("bkash,nagad,rocket,sslcommerz")
      .eq("id", "global")
      .maybeSingle();
    const pick = (v: any) => ({
      enabled: !!v?.enabled,
      number: v?.number ?? null,
      instructions: v?.instructions ?? null,
    });
    return {
      bkash: pick(data?.bkash),
      nagad: pick(data?.nagad),
      rocket: pick(data?.rocket),
      sslcommerz: { enabled: !!(data?.sslcommerz as any)?.enabled },
    };
  });
