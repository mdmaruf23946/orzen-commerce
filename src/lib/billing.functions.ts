// Billing / subscription server functions for store admins.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PUBLIC_FIELDS =
  "id,name,description,price,duration_days,billing_cycle,product_limit,order_limit,customer_limit,staff_limit,storage_mb,features,is_trial,trial_days,sort_order";

export const listPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("subscription_packages")
    .select(PUBLIC_FIELDS)
    .eq("is_active", true)
    .order("is_trial", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const myBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
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
        .select("id,amount,method,txn_id,status,invoice_no,created_at,cycle_start,cycle_end")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase.from("subscription_notifications" as any) as any)
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const exp = store.expires_at ? new Date(store.expires_at).getTime() : 0;
    const days_left = exp ? Math.max(0, Math.ceil((exp - Date.now()) / 86400000)) : 0;
    return { store, payments: payments ?? [], notifications: notifications ?? [], days_left };
  });

export const submitManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        packageId: z.string().uuid(),
        method: z.enum(["bkash", "nagad", "rocket"]),
        txn_id: z.string().trim().min(3).max(80),
        sender_number: z.string().trim().min(5).max(40),
        amount: z.number().min(0),
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

    const { data: payment, error } = await (supabase.from("payments") as any)
      .insert({
        store_id: store.id,
        package_id: data.packageId,
        amount: Number(pkg.price),
        method: data.method,
        txn_id: data.txn_id,
        sender_number: data.sender_number,
        status: "pending",
        notes: `Submitted by store owner. Awaiting verification.`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await (supabase.from("subscription_notifications" as any) as any).insert({
      store_id: store.id,
      type: "payment_pending",
      meta: { payment_id: payment.id, package: pkg.name },
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
    // Read minimal info only — never expose credentials.
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
