// Platform-owner-only server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const ownerDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const [users, stores, active, suspended, payments] = await Promise.all([
      sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "user"),
      sb.from("stores").select("*", { count: "exact", head: true }),
      sb.from("stores").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("stores").select("*", { count: "exact", head: true }).eq("status", "suspended"),
      sb.from("payments").select("amount").eq("status", "paid"),
    ]);
    const revenue = (payments.data ?? []).reduce((a: number, b: any) => a + Number(b.amount), 0);
    return {
      users: users.count ?? 0,
      stores: stores.count ?? 0,
      active: active.count ?? 0,
      suspended: suspended.count ?? 0,
      revenue,
    };
  });

export const listAllStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("stores")
      .select("*, subscription_packages(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setStoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        packageId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: pkg } = await context.supabase
      .from("subscription_packages")
      .select("duration_days")
      .eq("id", data.packageId)
      .maybeSingle();
    if (!pkg) throw new Error("Package not found");
    const expires = new Date();
    expires.setDate(expires.getDate() + pkg.duration_days);
    const { error } = await context.supabase
      .from("stores")
      .update({ package_id: data.packageId, expires_at: expires.toISOString() })
      .eq("id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("subscription_packages")
      .select("*")
      .order("price", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(500).nullish(),
        price: z.number().nonnegative(),
        duration_days: z.number().int().min(1).max(3650),
        billing_cycle: z.string().min(1).max(20).default("monthly"),
        product_limit: z.number().int().min(0).max(1000000),
        order_limit: z.number().int().min(0).max(10000000).nullish(),
        customer_limit: z.number().int().min(0).max(10000000).nullish(),
        staff_limit: z.number().int().min(0).max(1000).nullish(),
        storage_mb: z.number().int().min(0).max(1000000).nullish(),
        is_active: z.boolean(),
        is_trial: z.boolean().default(false),
        trial_days: z.number().int().min(0).max(365).default(0),
        features: z.record(z.string(), z.boolean()).default({}),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...rest } = data;
    const payload = rest as any;
    if (id) {
      const { error } = await (context.supabase.from("subscription_packages") as any).update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await (context.supabase.from("subscription_packages") as any)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("subscription_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const amIOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    return { isOwner: !!data };
  });

// ---------- ROLE MANAGEMENT + AUDIT ----------
const roleEnum = z.enum(["owner", "user"]);

async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, email: match.email ?? null };
    if (data.users.length < 100) break;
  }
  return null;
}

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email(), role: roleEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const target = await findUserByEmail(data.email);
    if (!target) throw new Error("User not found with that email");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: target.id, role: data.role });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    await context.supabase.from("role_audit_log").insert({
      actor_user_id: context.userId,
      actor_email: (context.claims.email as string | undefined) ?? null,
      target_user_id: target.id,
      target_email: target.email,
      role: data.role,
      action: "granted",
    });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ targetUserId: z.string().uuid(), role: roleEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    const targetEmail = u?.user?.email ?? null;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await context.supabase.from("role_audit_log").insert({
      actor_user_id: context.userId,
      actor_email: (context.claims.email as string | undefined) ?? null,
      target_user_id: data.targetUserId,
      target_email: targetEmail,
      role: data.role,
      action: "revoked",
    });
    return { ok: true };
  });

export const listRoleAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("role_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- BILLING & SUBSCRIPTIONS ----------

export const listPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    let q = (context.supabase.from("payments") as any)
      .select("*, stores(name,slug), subscription_packages(name,price)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), approve: z.boolean(), notes: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: pay } = await sb
      .from("payments")
      .select("id,store_id,package_id,amount,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "paid") throw new Error("Already verified");

    if (!data.approve) {
      const { error } = await sb
        .from("payments")
        .update({ status: "rejected", verified_by: context.userId, verified_at: new Date().toISOString(), notes: data.notes ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await sb.from("subscription_notifications").insert({
        store_id: pay.store_id,
        type: "payment_failed",
        meta: { payment_id: pay.id, reason: data.notes ?? "rejected" },
      });
      return { ok: true };
    }

    // Approve: load package, advance expiry
    const { data: pkg } = await sb
      .from("subscription_packages")
      .select("id,duration_days,name")
      .eq("id", pay.package_id)
      .maybeSingle();
    if (!pkg) throw new Error("Package missing");
    const { data: store } = await sb
      .from("stores")
      .select("id,expires_at")
      .eq("id", pay.store_id)
      .maybeSingle();
    const now = new Date();
    const base =
      store?.expires_at && new Date(store.expires_at) > now ? new Date(store.expires_at) : now;
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + (pkg.duration_days || 30));
    const cycleStart = now.toISOString().slice(0, 10);
    const cycleEnd = newExpiry.toISOString().slice(0, 10);
    const invoiceNo = `INV-S-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${pay.id.slice(0, 6).toUpperCase()}`;

    const { error: payErr } = await sb
      .from("payments")
      .update({
        status: "paid",
        verified_by: context.userId,
        verified_at: now.toISOString(),
        invoice_no: invoiceNo,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (payErr) throw new Error(payErr.message);

    const { error: stErr } = await sb
      .from("stores")
      .update({
        package_id: pkg.id,
        expires_at: newExpiry.toISOString(),
        last_renewed_at: now.toISOString(),
        subscription_status: "active",
      })
      .eq("id", pay.store_id);
    if (stErr) throw new Error(stErr.message);

    await sb.from("subscription_notifications").insert({
      store_id: pay.store_id,
      type: "payment_success",
      meta: { payment_id: pay.id, invoice_no: invoiceNo, package: pkg.name },
    });
    return { ok: true, invoice_no: invoiceNo };
  });

export const extendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid(), days: z.number().int().min(1).max(3650) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: s } = await sb.from("stores").select("expires_at").eq("id", data.storeId).maybeSingle();
    const base = s?.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
    base.setDate(base.getDate() + data.days);
    const { error } = await sb
      .from("stores")
      .update({ expires_at: base.toISOString(), subscription_status: "active" })
      .eq("id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        status: z.enum(["trialing", "active", "expired", "suspended", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { error } = await sb
      .from("stores")
      .update({ subscription_status: data.status })
      .eq("id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revenueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const last30 = new Date(now.getTime() - 30 * 86400000);

    const [{ data: payments }, { data: stores }] = await Promise.all([
      sb.from("payments").select("amount,status,created_at,verified_at").eq("status", "paid"),
      sb.from("stores").select("subscription_status,expires_at,last_renewed_at"),
    ]);
    const sum = (rows: any[], gte?: Date) =>
      (rows ?? [])
        .filter((p) => !gte || new Date(p.verified_at || p.created_at) >= gte)
        .reduce((a, p) => a + Number(p.amount || 0), 0);

    const today = sum(payments ?? [], dayStart);
    const month = sum(payments ?? [], monthStart);
    const year = sum(payments ?? [], yearStart);
    const total = sum(payments ?? []);

    const counts = { trialing: 0, active: 0, expired: 0, suspended: 0 };
    for (const s of stores ?? []) {
      const k = (s.subscription_status ?? "active") as keyof typeof counts;
      if (counts[k] !== undefined) counts[k]++;
    }
    // renewal rate = paid renewals in last 30 / stores expiring in last 30
    const expiringLast30 = (stores ?? []).filter(
      (s: any) => s.expires_at && new Date(s.expires_at) >= last30 && new Date(s.expires_at) <= new Date(now.getTime() + 30 * 86400000),
    ).length;
    const renewedLast30 = (stores ?? []).filter(
      (s: any) => s.last_renewed_at && new Date(s.last_renewed_at) >= last30,
    ).length;
    const renewal_rate = expiringLast30 ? Math.round((renewedLast30 / expiringLast30) * 100) : 0;

    return { today, month, year, total, ...counts, renewal_rate };
  });

export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data } = await sb
      .from("platform_payment_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    return (
      data ?? { id: "global", bkash: {}, nagad: {}, rocket: {}, sslcommerz: {} }
    );
  });

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bkash: z.record(z.string(), z.any()).optional(),
        nagad: z.record(z.string(), z.any()).optional(),
        rocket: z.record(z.string(), z.any()).optional(),
        sslcommerz: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { error } = await sb
      .from("platform_payment_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubscriptionStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filter: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    let q = sb
      .from("stores")
      .select(
        "id,name,slug,subscription_status,trial_ends_at,expires_at,last_renewed_at,package_id,owner_user_id, subscription_packages(name,price)",
      )
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (data.filter && data.filter !== "all") q = q.eq("subscription_status", data.filter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOwnerBillingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase.from("platform_billing_settings" as any) as any)
      .select("discount_3m,discount_6m,discount_yearly")
      .eq("id", "global")
      .maybeSingle();
    return {
      discount_3m: Number(data?.discount_3m ?? 5),
      discount_6m: Number(data?.discount_6m ?? 10),
      discount_yearly: Number(data?.discount_yearly ?? 20),
    };
  });

export const updateBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        discount_3m: z.number().min(0).max(100),
        discount_6m: z.number().min(0).max(100),
        discount_yearly: z.number().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase.from("platform_billing_settings" as any) as any)
      .upsert({ id: "global", ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CONTROL CENTER DASHBOARD ----------

export const ownerControlCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now.getTime() - 7 * 86400000);
    const last30 = new Date(now.getTime() - 30 * 86400000);
    const next7 = new Date(now.getTime() + 7 * 86400000);

    const [
      { data: payments },
      { data: stores },
      { count: usersCount },
      { data: aiUsage },
      { data: recentPayments },
      { data: recentStores },
      { data: recentAudit },
      { count: pendingPayments },
    ] = await Promise.all([
      sb.from("payments").select("amount,status,created_at,verified_at").eq("status", "paid"),
      sb.from("stores").select("id,name,subscription_status,expires_at,trial_ends_at,created_at,status"),
      sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "user"),
      sb.from("ai_usage").select("cost_usd,total_tokens,created_at").gte("created_at", last30.toISOString()),
      sb.from("payments").select("id,amount,method,status,created_at,stores(name)").order("created_at", { ascending: false }).limit(5),
      sb.from("stores").select("id,name,slug,created_at").order("created_at", { ascending: false }).limit(5),
      sb.from("role_audit_log").select("actor_email,target_email,role,action,created_at").order("created_at", { ascending: false }).limit(5),
      sb.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const sum = (rows: any[], gte?: Date) =>
      (rows ?? [])
        .filter((p) => !gte || new Date(p.verified_at || p.created_at) >= gte)
        .reduce((a, p) => a + Number(p.amount || 0), 0);

    const revenueToday = sum(payments ?? [], dayStart);
    const revenueMonth = sum(payments ?? [], monthStart);
    const revenueTotal = sum(payments ?? []);
    const mrr = revenueMonth;

    // 7-day sparkline
    const days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d.getTime() + 86400000);
      const total = (payments ?? [])
        .filter((p: any) => {
          const t = new Date(p.verified_at || p.created_at);
          return t >= d && t < next;
        })
        .reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
      days.push({ date: d.toISOString().slice(5, 10), total });
    }

    // Store counts
    const totalStores = (stores ?? []).length;
    let activeStores = 0, trialing = 0, expired = 0, suspended = 0, expiringSoon = 0;
    for (const s of stores ?? []) {
      const st = s.subscription_status ?? "active";
      if (st === "active") activeStores++;
      else if (st === "trialing") trialing++;
      else if (st === "expired") expired++;
      else if (st === "suspended") suspended++;
      if (s.expires_at && new Date(s.expires_at) > now && new Date(s.expires_at) <= next7) expiringSoon++;
    }
    const newStores7d = (stores ?? []).filter((s: any) => new Date(s.created_at) >= last7).length;

    // AI usage
    const aiCost = (aiUsage ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd || 0), 0);
    const aiTokens = (aiUsage ?? []).reduce((a: number, r: any) => a + Number(r.total_tokens || 0), 0);
    const aiRequests = (aiUsage ?? []).length;

    // Recent activity feed (mixed)
    const activity: any[] = [];
    for (const p of recentPayments ?? []) {
      activity.push({
        type: "payment",
        at: p.created_at,
        text: `Payment ${p.status} · ৳${Number(p.amount).toFixed(0)} · ${p.stores?.name ?? "—"}`,
      });
    }
    for (const s of recentStores ?? []) {
      activity.push({ type: "store", at: s.created_at, text: `New store: ${s.name}` });
    }
    for (const a of recentAudit ?? []) {
      activity.push({
        type: "role",
        at: a.created_at,
        text: `Role ${a.action}: ${a.role} → ${a.target_email ?? "user"}`,
      });
    }
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      revenue: { today: revenueToday, month: revenueMonth, total: revenueTotal, mrr, spark: days },
      stores: { total: totalStores, active: activeStores, trialing, expired, suspended, expiringSoon, new7d: newStores7d },
      users: usersCount ?? 0,
      ai: { cost: aiCost, tokens: aiTokens, requests: aiRequests },
      pendingPayments: pendingPayments ?? 0,
      activity: activity.slice(0, 10),
    };
  });

// ---------- STORE DETAIL / USAGE ----------

export const getStoreUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const last30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      { data: store },
      { count: products },
      { count: orders },
      { count: orders30 },
      { data: revenueRows },
      { data: aiRows },
      { data: recentPayments },
    ] = await Promise.all([
      sb.from("stores")
        .select("*, subscription_packages(name,price,product_limit,order_limit,customer_limit,storage_mb)")
        .eq("id", data.storeId).maybeSingle(),
      sb.from("products").select("*", { count: "exact", head: true }).eq("store_id", data.storeId),
      sb.from("orders").select("*", { count: "exact", head: true }).eq("store_id", data.storeId),
      sb.from("orders").select("*", { count: "exact", head: true })
        .eq("store_id", data.storeId).gte("created_at", last30),
      sb.from("orders").select("total,status,customer_phone,created_at").eq("store_id", data.storeId),
      sb.from("ai_usage").select("cost_usd,total_tokens,created_at")
        .eq("store_id", data.storeId).gte("created_at", last30),
      sb.from("payments").select("id,amount,status,method,created_at,invoice_no")
        .eq("store_id", data.storeId).order("created_at", { ascending: false }).limit(10),
    ]);

    const revenue = (revenueRows ?? [])
      .filter((o: any) => o.status === "delivered" || o.status === "confirmed" || o.status === "processing")
      .reduce((a: number, o: any) => a + Number(o.total || 0), 0);
    const customers = new Set((revenueRows ?? []).map((o: any) => o.customer_phone).filter(Boolean)).size;
    const aiCost = (aiRows ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd || 0), 0);
    const aiTokens = (aiRows ?? []).reduce((a: number, r: any) => a + Number(r.total_tokens || 0), 0);

    return {
      store,
      counts: {
        products: products ?? 0,
        orders: orders ?? 0,
        orders30d: orders30 ?? 0,
        customers,
      },
      revenue,
      ai: { cost: aiCost, tokens: aiTokens, requests: (aiRows ?? []).length },
      recentPayments: recentPayments ?? [],
    };
  });


