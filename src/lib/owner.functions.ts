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
        landing_page_limit: z.number().int().min(0).max(100000).nullish(),
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
    await supabaseAdmin.from("role_audit_log").insert({
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
    await supabaseAdmin.from("role_audit_log").insert({
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
    // Attach email log summaries per payment (best-effort)
    const ids = (rows ?? []).map((r: any) => r.id);
    let logs: any[] = [];
    if (ids.length) {
      const { data: lrows } = await (context.supabase.from("email_logs" as any) as any)
        .select("id,related_payment_id,template,status,last_error,sent_at,attempts,created_at")
        .in("related_payment_id", ids);
      logs = lrows ?? [];
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      email_logs: logs.filter((l: any) => l.related_payment_id === r.id),
    }));
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        notes: z.string().max(500).optional(),
        // Amount the owner actually received (may differ from what the merchant claimed).
        receivedAmount: z.number().min(0).max(10_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: pay } = await sb
      .from("payments")
      .select(
        "id,store_id,package_id,amount,status,customer_email,method,txn_id,invoice_no,purpose",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "paid") throw new Error("Already verified");
    if (data.approve && typeof data.receivedAmount === "number") {
      const r = Math.round(data.receivedAmount * 100) / 100;
      if (r !== Number(pay.amount)) {
        const { error: aErr } = await sb.from("payments").update({ amount: r }).eq("id", pay.id);
        if (aErr) throw new Error(aErr.message);
        pay.amount = r;
      }
    }

    const { data: store } = await sb
      .from("stores")
      .select("id,name,slug,expires_at,owner_user_id")
      .eq("id", pay.store_id)
      .maybeSingle();
    const { data: pkg } = await sb
      .from("subscription_packages")
      .select("id,duration_days,name,price")
      .eq("id", pay.package_id)
      .maybeSingle();

    // Load platform bkash config for support email
    const { data: pset } = await (sb.from("platform_payment_settings") as any)
      .select("bkash")
      .eq("id", "global")
      .maybeSingle();
    const supportEmail: string =
      (pset?.bkash as any)?.notification_email || "support@orzen.app";

    // Import email helpers lazily
    const { enqueueEmail, tplPaymentApproved, tplPaymentRejected } = await import(
      "./emails.server"
    );

    if (!data.approve) {
      const reason = (data.notes ?? "").trim();
      if (reason.length < 10) throw new Error("Please provide a rejection reason (at least 10 characters).");
      const { error } = await sb
        .from("payments")
        .update({
          status: "rejected",
          verified_by: context.userId,
          verified_at: new Date().toISOString(),
          notes: reason,
          rejection_reason: reason,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await sb.from("subscription_notifications").insert({
        store_id: pay.store_id,
        type: "payment_failed",
        meta: { payment_id: pay.id, reason },
      });
      if (pay.customer_email) {
        const isTopup = (pay as any).purpose === "wallet_topup";
        const tpl = await tplPaymentRejected({
          ownerName: null,
          planName: isTopup ? "Wallet Add Fund" : (pkg?.name ?? "your plan"),
          amount: Number(pay.amount),
          reason,
          supportEmail,
          retryUrl: "/admin/billing",
          customerEmail: pay.customer_email,
        });
        await enqueueEmail({
          to: pay.customer_email,
          template: "payment_rejected",
          subject: tpl.subject,
          html: tpl.html,
          payload: { payment_id: pay.id, reason },
          relatedPaymentId: pay.id,
        });
      }
      return { ok: true };
    }

    // Wallet top-up approval: credit the merchant wallet instead of a plan.
    if ((pay as any).purpose === "wallet_topup") {
      const nowT = new Date();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adm: any = supabaseAdmin;
      const { data: inv } = await adm
        .from("subscription_invoices")
        .select("id,user_id,total")
        .eq("invoice_no", (pay as any).invoice_no)
        .maybeSingle();
      const walletUserId = inv?.user_id ?? store?.owner_user_id;
      if (!walletUserId) throw new Error("Wallet owner not found for this payment");

      const { creditWallet } = await import("./wallet.server");
      const res = await creditWallet(adm, {
        userId: walletUserId,
        amount: Number(pay.amount),
        type: "topup",
        invoiceId: inv?.id ?? null,
        reference: (pay as any).invoice_no ?? null,
        note: `Fund added via ${pay.method ?? "manual"} (verified)`,
        storeId: pay.store_id,
      });
      if (!res?.ok && !res?.already) throw new Error(res?.error ?? "Could not credit the wallet");

      await adm
        .from("payments")
        .update({
          status: "paid",
          verified_by: context.userId,
          verified_at: nowT.toISOString(),
          notes: data.notes ?? "Wallet top-up verified",
        })
        .eq("id", pay.id);
      if (inv?.id) {
        await adm
          .from("subscription_invoices")
          .update({ status: "paid", paid_at: nowT.toISOString() })
          .eq("id", inv.id);
      }
      await adm
        .from("subscription_notifications")
        .insert({
          store_id: pay.store_id,
          type: "payment_success",
          meta: {
            payment_id: pay.id,
            purpose: "wallet_topup",
            amount: Number(pay.amount),
            message: `৳${Number(pay.amount)} added to your wallet.`,
          },
        })
        .then(() => null, () => null);

      if (pay.customer_email) {
        try {
          const { tplWalletTopupApproved } = await import("./emails.server");
          const tpl = await tplWalletTopupApproved({
            ownerName: null,
            storeName: store?.name ?? null,
            customerEmail: pay.customer_email,
            amount: Number(pay.amount),
            method: pay.method ?? "manual",
            txnId: pay.txn_id ?? null,
            invoiceNo: (pay as any).invoice_no ?? null,
            submittedAt: nowT.toISOString().replace("T", " ").slice(0, 16) + " UTC",
            balanceAfter: typeof res?.balance === "number" ? res.balance : null,
            walletUrl: "/admin/billing",
          });
          await enqueueEmail({
            to: pay.customer_email,
            template: "wallet_topup_approved",
            subject: tpl.subject,
            html: tpl.html,
            payload: { payment_id: pay.id, amount: Number(pay.amount) },
            relatedPaymentId: pay.id,
          });
        } catch (e) {
          console.error("[wallet] approval email failed", (e as Error).message);
        }
      }
      return { ok: true, invoice_no: (pay as any).invoice_no ?? null };
    }

    if (!pkg) throw new Error("Package missing");
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

    // Extra money beyond the plan price goes to the merchant's Ad Fund wallet.
    let adFundCredit = 0;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adm: any = supabaseAdmin;
      let expected = Number(pkg.price ?? 0);
      if (pay.invoice_no) {
        const { data: inv } = await adm.from("subscription_invoices")
          .select("total").eq("invoice_no", pay.invoice_no).maybeSingle();
        if (inv?.total != null) expected = Number(inv.total);
      }
      const excess = Math.round((Number(pay.amount) - expected) * 100) / 100;
      if (expected > 0 && excess > 0 && store?.owner_user_id) {
        const { creditWallet } = await import("./wallet.server");
        const res = await creditWallet(adm, {
          userId: store.owner_user_id,
          amount: excess,
          type: "topup",
          invoiceId: null,
          reference: `EXCESS-${pay.id}`,
          note: `Extra ৳${excess} from ${pkg.name} payment added to Ad Fund`,
          storeId: pay.store_id,
        });
        if (res?.ok || res?.already) adFundCredit = excess;
      }
    } catch (e) {
      console.error("[verifyPayment] ad fund credit failed", (e as Error).message);
    }

    await sb.from("subscription_notifications").insert({
      store_id: pay.store_id,
      type: "payment_success",
      meta: { payment_id: pay.id, invoice_no: invoiceNo, package: pkg.name },
    });

    if (pay.customer_email) {
      const tpl = await tplPaymentApproved({
        ownerName: null,
        planName: pkg.name,
        amount: Number(pay.amount),
        activationDate: now.toLocaleDateString(),
        expiryDate: newExpiry.toLocaleDateString(),
        storeUrl: store?.slug ? `/store/${store.slug}` : "/",
        loginUrl: "/admin",
        invoiceNo,
      });
      await enqueueEmail({
        to: pay.customer_email,
        template: "payment_approved",
        subject: tpl.subject,
        html: tpl.html,
        payload: { payment_id: pay.id, invoice_no: invoiceNo },
        relatedPaymentId: pay.id,
      });
    }
    return { ok: true, invoice_no: invoiceNo, adFundCredit };
  });

export const retryEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { trySendLog } = await import("./emails.server");
    return trySendLog(data.id);
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
    // Merge with existing row so partial updates don't wipe other gateways.
    const { data: existing } = await sb
      .from("platform_payment_settings")
      .select("bkash,nagad,rocket,sslcommerz")
      .eq("id", "global")
      .maybeSingle();
    const merged = {
      id: "global",
      bkash: { ...(existing?.bkash ?? {}), ...(data.bkash ?? {}) },
      nagad: { ...(existing?.nagad ?? {}), ...(data.nagad ?? {}) },
      rocket: { ...(existing?.rocket ?? {}), ...(data.rocket ?? {}) },
      sslcommerz: { ...(existing?.sslcommerz ?? {}), ...(data.sslcommerz ?? {}) },
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("platform_payment_settings")
      .upsert(merged, { onConflict: "id" });
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
      sb.from("ai_usage").select("cost_usd,prompt_tokens,completion_tokens,created_at").gte("created_at", last30.toISOString()),
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
    const aiTokens = (aiUsage ?? []).reduce((a: number, r: any) => a + (Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0)), 0);
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
    // Owner verified above; admin client so per-store RLS doesn't hide counts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
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
        .select("*, subscription_packages(name,price,product_limit,order_limit,customer_limit,storage_mb,features,duration_days)")
        .eq("id", data.storeId).maybeSingle(),
      sb.from("products").select("id", { count: "exact", head: true }).eq("store_id", data.storeId),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("store_id", data.storeId),
      sb.from("orders").select("id", { count: "exact", head: true })
        .eq("store_id", data.storeId).gte("created_at", last30),
      sb.from("orders").select("subtotal,status,phone,created_at").eq("store_id", data.storeId),
      sb.from("ai_usage").select("cost_usd,prompt_tokens,completion_tokens,created_at")
        .eq("store_id", data.storeId).gte("created_at", last30),
      sb.from("payments").select("id,amount,status,method,created_at,invoice_no,purpose")
        .eq("store_id", data.storeId).order("created_at", { ascending: false }).limit(10),
    ]);

    // orders.subtotal already stores the grand total.
    const statusCounts: Record<string, number> = {};
    for (const o of revenueRows ?? []) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    const revenue = (revenueRows ?? [])
      .filter((o: any) => o.status === "delivered" || o.status === "confirmed" || o.status === "processing")
      .reduce((a: number, o: any) => a + Number(o.subtotal || 0), 0);
    const customers = new Set((revenueRows ?? []).map((o: any) => o.phone).filter(Boolean)).size;
    const aiCost = (aiRows ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd || 0), 0);
    const aiTokens = (aiRows ?? []).reduce((a: number, r: any) => a + (Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0)), 0);

    let adFund = 0;
    if (store?.owner_user_id) {
      const { data: w } = await sb.from("merchant_wallets").select("balance")
        .eq("user_id", store.owner_user_id).maybeSingle();
      adFund = Number(w?.balance ?? 0);
    }

    return {
      store,
      counts: {
        products: products ?? 0,
        orders: orders ?? 0,
        orders30d: orders30 ?? 0,
        customers,
      },
      statusCounts,
      revenue,
      adFund,
      ai: { cost: aiCost, tokens: aiTokens, requests: (aiRows ?? []).length },
      recentPayments: recentPayments ?? [],
    };
  });

// ---------- AI CONTROL CENTER ----------

const MASK = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);

export const listStoresAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const last30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [{ data: stores }, { data: cfgs }, { data: usage }] = await Promise.all([
      sb.from("stores").select("id,name,slug,subscription_status,status").order("name"),
      sb.from("store_ai_config").select("*"),
      sb.from("ai_usage").select("store_id,cost_usd,prompt_tokens,completion_tokens,created_at")
        .gte("created_at", last30),
    ]);

    const cfgMap = new Map<string, any>();
    for (const c of cfgs ?? []) cfgMap.set(c.store_id, c);

    const usageMap = new Map<string, { requests: number; tokens: number; cost: number }>();
    for (const r of usage ?? []) {
      const k = r.store_id ?? "unknown";
      const cur = usageMap.get(k) ?? { requests: 0, tokens: 0, cost: 0 };
      cur.requests++;
      cur.tokens += Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0);
      cur.cost += Number(r.cost_usd || 0);
      usageMap.set(k, cur);
    }

    return (stores ?? []).map((s: any) => {
      const c = cfgMap.get(s.id);
      const u = usageMap.get(s.id) ?? { requests: 0, tokens: 0, cost: 0 };
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        subscription_status: s.subscription_status,
        status: s.status,
        config: c ? {
          enabled: c.enabled,
          provider: c.provider,
          model: c.model,
          monthly_token_limit: c.monthly_token_limit,
          notes: c.notes,
          openai_key_masked: MASK(c.openai_api_key),
          gemini_key_masked: MASK(c.gemini_api_key),
          has_openai: !!c.openai_api_key,
          has_gemini: !!c.gemini_api_key,
        } : null,
        usage30d: u,
      };
    });
  });

export const upsertStoreAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      storeId: z.string().uuid(),
      enabled: z.boolean().optional(),
      provider: z.enum(["platform", "openai", "gemini"]).optional(),
      model: z.string().max(120).nullish(),
      openai_api_key: z.string().max(500).nullish(),
      gemini_api_key: z.string().max(500).nullish(),
      monthly_token_limit: z.number().int().min(0).nullish(),
      notes: z.string().max(500).nullish(),
      clear_openai: z.boolean().optional(),
      clear_gemini: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: existing } = await sb.from("store_ai_config").select("id").eq("store_id", data.storeId).maybeSingle();
    const patch: any = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.provider !== undefined) patch.provider = data.provider;
    if (data.model !== undefined) patch.model = data.model;
    if (data.monthly_token_limit !== undefined) patch.monthly_token_limit = data.monthly_token_limit;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.clear_openai) patch.openai_api_key = null;
    else if (data.openai_api_key) patch.openai_api_key = data.openai_api_key;
    if (data.clear_gemini) patch.gemini_api_key = null;
    else if (data.gemini_api_key) patch.gemini_api_key = data.gemini_api_key;

    if (existing) {
      const { error } = await sb.from("store_ai_config").update(patch).eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("store_ai_config").insert({ store_id: data.storeId, ...patch });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const aiControlCenterOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const now = Date.now();
    const last30 = new Date(now - 30 * 86400000).toISOString();
    const last7 = new Date(now - 7 * 86400000);

    const [{ data: globalSettings }, { data: usage }, { count: enabledStores }, { count: totalConfigs }] = await Promise.all([
      sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle(),
      sb.from("ai_usage").select("model,cost_usd,prompt_tokens,completion_tokens,created_at,store_id")
        .gte("created_at", last30),
      sb.from("store_ai_config").select("*", { count: "exact", head: true }).eq("enabled", true),
      sb.from("store_ai_config").select("*", { count: "exact", head: true }),
    ]);

    let requests = 0, tokens = 0, cost = 0, req7 = 0, cost7 = 0;
    const byModel = new Map<string, { requests: number; tokens: number; cost: number }>();
    const days: { date: string; cost: number; requests: number }[] = [];
    const dayStart0 = new Date(now); dayStart0.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dayStart0.getTime() - i * 86400000);
      days.push({ date: d.toISOString().slice(5, 10), cost: 0, requests: 0 });
    }
    const dayZeroTs = new Date(dayStart0.getTime() - 6 * 86400000).getTime();
    for (const r of usage ?? []) {
      requests++;
      const t = Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0);
      const c = Number(r.cost_usd || 0);
      tokens += t; cost += c;
      const created = new Date(r.created_at);
      if (created >= last7) { req7++; cost7 += c; }
      const bm = byModel.get(r.model) ?? { requests: 0, tokens: 0, cost: 0 };
      bm.requests++; bm.tokens += t; bm.cost += c;
      byModel.set(r.model, bm);
      const dayIdx = Math.floor((created.getTime() - dayZeroTs) / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) { days[dayIdx].cost += c; days[dayIdx].requests++; }
    }

    return {
      global: {
        enabled: !!globalSettings?.enabled,
        default_model: globalSettings?.default_model ?? null,
        has_lovable_key: !!globalSettings?.provider_api_key,
        openai_key_masked: MASK(globalSettings?.openai_api_key),
        gemini_key_masked: MASK(globalSettings?.gemini_api_key),
        has_openai: !!globalSettings?.openai_api_key,
        has_gemini: !!globalSettings?.gemini_api_key,
      },
      totals: { requests, tokens, cost, req7, cost7 },
      spark: days,
      byModel: Array.from(byModel.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.cost - a.cost),
      configuredStores: totalConfigs ?? 0,
      enabledStores: enabledStores ?? 0,
    };
  });

export const updateGlobalAiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      openai_api_key: z.string().max(500).nullish(),
      gemini_api_key: z.string().max(500).nullish(),
      clear_openai: z.boolean().optional(),
      clear_gemini: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const patch: any = {};
    if (data.clear_openai) patch.openai_api_key = null;
    else if (data.openai_api_key) patch.openai_api_key = data.openai_api_key;
    if (data.clear_gemini) patch.gemini_api_key = null;
    else if (data.gemini_api_key) patch.gemini_api_key = data.gemini_api_key;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await sb.from("ai_global_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLATFORM AI PROVIDER KEYS (serial rotation, multi-provider) ----------
async function loadGeminiKeys(sb: any) {
  const helpers = await import("@/lib/gemini-keys.server");
  const { data } = await sb.from("ai_global_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
  return { helpers, keys: helpers.normalizeGeminiKeys(data?.gemini_api_keys) };
}

async function saveGeminiKeys(sb: any, keys: any[]) {
  // Keep the legacy single-key column in sync with the first usable Gemini key.
  const helpers = await import("@/lib/gemini-keys.server");
  const gemini = (keys as any[]).filter((k) => (k.provider ?? "gemini") === "gemini");
  const active = helpers.pickActiveGeminiKey(gemini as any);
  const { error } = await sb
    .from("ai_global_settings")
    .update({ gemini_api_keys: keys, gemini_api_key: active?.key ?? gemini[0]?.key ?? null })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export const listGlobalGeminiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { helpers, keys } = await loadGeminiKeys(sb);
    const today = helpers.dhakaToday();
    const active = helpers.pickActiveGeminiKey(keys);
    return {
      today,
      active_id: active?.id ?? null,
      providers: Object.values(helpers.PROVIDER_PRESETS).map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
        vision: p.vision,
        keyHint: p.keyHint,
        signupUrl: p.signupUrl,
      })),
      keys: keys.map((k, i) => ({
        id: k.id,
        label: k.label,
        provider: k.provider,
        provider_name: helpers.providerPreset(k.provider).name,
        model: k.model,
        effective_model: k.model || helpers.providerPreset(k.provider).model,
        base_url: k.base_url,
        vision: k.vision,
        masked: helpers.maskGeminiKey(k.key),
        enabled: k.enabled,
        failed_today: k.failed_on === today,
        last_error: k.last_error,
        daily_token_limit: k.daily_token_limit ?? null,
        monthly_token_limit: k.monthly_token_limit ?? null,
        order: i + 1,
      })),
    };
  });

export const addGlobalGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      label: z.string().max(60).optional(),
      key: z.string().min(10).max(500),
      provider: z.enum(["gemini", "groq", "openrouter", "openai", "custom"]).optional(),
      base_url: z.string().max(300).optional(),
      model: z.string().max(120).optional(),
      vision: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const helpers = await import("@/lib/gemini-keys.server");
    const { keys } = await loadGeminiKeys(sb);
    if (keys.length >= 20) throw new Error("Maximum of 20 API keys.");
    let baseUrl = (data.base_url ?? "").trim();
    let modelName = (data.model ?? "").trim();
    const cleanKey = helpers.cleanApiKey(data.key);
    if (cleanKey.length < 10) throw new Error("Please paste a valid API key.");
    // When the caller gives only a key (+name), work out the provider: first by
    // the key's shape, then by asking known AI services which one accepts it.
    let provider = data.provider ?? helpers.guessProviderFromKey(cleanKey);
    let detectedName: string | null = null;
    if (!data.provider && !baseUrl) {
      const { detected, lastError } = await helpers.detectKeyProvider(cleanKey);
      if (detected) {
        provider = detected.provider;
        detectedName = detected.service;
        if (detected.base_url) baseUrl = detected.base_url;
        if (!modelName && detected.model) modelName = detected.model;
      } else if (data.label && (await helpers.detectFromWebsite(data.label, cleanKey).then((w) => {
        if (!w) return false;
        provider = "custom"; baseUrl = w.base_url; if (!modelName) modelName = w.model;
        detectedName = data.label!.trim();
        return true;
      }))) {
        // detected from the website name in "Display name"
      } else {
        if (lastError) console.warn("[ai-keys] auto-detect failed:", lastError.slice(0, 200));
        const n = helpers.DETECTABLE_SERVICE_NAMES.length;
        throw new Error(
          `This key was rejected by all ${n} AI services we checked (Google Gemini, Groq, OpenRouter, OpenAI, DeepSeek, Claude, Qwen, Kimi and more). ` +
            "This almost always means the key itself is not valid: it was copied incompletely, it was deleted or regenerated on the website that gave it, " +
            "or the account is not activated yet. Please create a fresh key on that website and paste the full key. " +
            "If the key is from another website, write that website's address (e.g. example.com) in Display name, or fill in its API base URL and Model ID.",
        );
      }
    }
    const preset = helpers.providerPreset(provider);
    if (provider === "custom" && !/^https?:\/\//i.test(baseUrl)) {
      throw new Error("Please fill in the API base URL (it must start with https://).");
    }
    if (provider === "custom" && !modelName) {
      const found = await helpers.discoverWorkingModel(baseUrl, cleanKey);
      if (found) modelName = found;
    }
    if (provider === "custom" && !modelName) {
      throw new Error("This AI service did not accept the key, or no working model was found. Please check the key and fill in the Model ID.");
    }
    const newId = crypto.randomUUID();
    keys.push({
      id: newId,
      label: (data.label ?? "").trim() || `${detectedName ?? preset.name} ${keys.length + 1}`,
      key: cleanKey,
      provider,
      base_url: baseUrl || null,
      model: modelName || null,
      vision: data.vision ?? preset.vision,
      enabled: true,
      failed_on: null,
      last_error: null,
    });
    await saveGeminiKeys(sb, keys);
    return { ok: true, id: newId };
  });

export const updateGlobalGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().min(1),
      label: z.string().max(60).optional(),
      enabled: z.boolean().optional(),
      vision: z.boolean().optional(),
      model: z.string().max(120).optional(),
      base_url: z.string().max(300).optional(),
      key: z.string().min(10).max(500).optional(),
      provider: z.enum(["gemini", "groq", "openrouter", "openai", "custom"]).optional(),
      reset_failure: z.boolean().optional(),
      daily_token_limit: z.number().int().min(0).max(1e12).nullable().optional(),
      monthly_token_limit: z.number().int().min(0).max(1e13).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { keys } = await loadGeminiKeys(sb);
    const k = keys.find((x) => x.id === data.id);
    if (!k) throw new Error("Key not found");
    if (data.label !== undefined) k.label = data.label.trim() || k.label;
    if (data.enabled !== undefined) k.enabled = data.enabled;
    if (data.vision !== undefined) k.vision = data.vision;
    if (data.model !== undefined) k.model = data.model.trim() || null;
    if (data.base_url !== undefined) k.base_url = data.base_url.trim() || null;
    if (data.provider !== undefined) k.provider = data.provider;
    if (data.daily_token_limit !== undefined) k.daily_token_limit = data.daily_token_limit || null;
    if (data.monthly_token_limit !== undefined) k.monthly_token_limit = data.monthly_token_limit || null;
    const newKey = data.key !== undefined ? data.key.trim().replace(/^["'`]+|["'`]+$/g, "").trim().replace(/^bearer\s+/i, "").replace(/\s+/g, "") : undefined;
    if (newKey !== undefined && newKey && newKey !== k.key) {
      k.key = newKey;
      // The old failure belongs to the old key — clear it so the new one starts fresh.
      k.failed_on = null;
      k.last_error = null;
    }
    if (data.reset_failure) {
      k.failed_on = null;
      k.last_error = null;
    }
    if (k.provider === "custom") {
      const baseUrl = (k.base_url ?? "").trim();
      if (!/^https?:\/\//i.test(baseUrl)) throw new Error("A custom provider needs an OpenAI-compatible base URL.");
      if (!(k.model ?? "").trim()) throw new Error("A custom provider needs a model name.");
    }
    await saveGeminiKeys(sb, keys);
    return { ok: true };
  });

export const deleteGlobalGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { keys } = await loadGeminiKeys(sb);
    await saveGeminiKeys(sb, keys.filter((k) => k.id !== data.id));
    return { ok: true };
  });

export const moveGlobalGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1), direction: z.enum(["up", "down"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { keys } = await loadGeminiKeys(sb);
    const i = keys.findIndex((k) => k.id === data.id);
    const j = data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= keys.length) return { ok: true };
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    await saveGeminiKeys(sb, keys);
    return { ok: true };
  });

export const testGlobalGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { helpers, keys } = await loadGeminiKeys(sb);
    const k = keys.find((x) => x.id === data.id);
    if (!k) throw new Error("Key not found");
    const res = await helpers.testProviderKey(k);
    if (res.ok) {
      k.failed_on = null;
      k.last_error = null;
    } else {
      k.failed_on = helpers.dhakaToday();
      k.last_error = res.error ?? "Connection failed";
    }
    await saveGeminiKeys(sb, keys);
    return res;
  });




// ---------- GLOBAL STORE TEMPLATE ----------
export const getStoreTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_template")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const templateSchema = z.object({
  description: z.string().max(2000).optional().nullable(),
  all_category_image_url: z.string().max(500).optional().nullable(),
  primary_color: z.string().max(20).optional().nullable(),
  header_color: z.string().max(20).optional().nullable(),
  title_bar_color: z.string().max(20).optional().nullable(),
  footer_color: z.string().max(20).optional().nullable(),
  button_color: z.string().max(20).optional().nullable(),
  theme: z.any().optional(),
  seo: z.any().optional(),
  marketing: z.any().optional(),
  delivery: z.any().optional(),
  payments_config: z.any().optional(),
  product_defaults: z.any().optional(),
  banners: z.array(z.any()).optional(),
  categories: z.array(z.any()).optional(),
  products: z.array(z.any()).optional(),
  pages: z.array(z.any()).optional(),
});

export const updateStoreTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = { updated_by: context.userId };
    for (const [k, v] of Object.entries(data)) if (v !== undefined) patch[k] = v;
    const { data: updated, error } = await (context.supabase as any)
      .from("store_template")
      .update(patch)
      .eq("id", "global")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return updated;
  });

// Apply the current global template to existing stores.
// Modes:
//  - "missing-only": seed only stores with zero categories/products/banners
//  - "reset":        wipe categories/products/banners on every store and reseed
export const applyTemplateToAllStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ mode: z.enum(["missing-only", "reset"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchTemplate, templateStoreFields, seedStoreFromTemplate, wipeStoreChildren } =
      await import("@/lib/store-template");

    const tpl = await fetchTemplate(supabaseAdmin);
    if (!tpl) throw new Error("No template configured");

    const { data: stores, error } = await supabaseAdmin
      .from("stores")
      .select("id");
    if (error) throw new Error(error.message);

    let updated = 0;
    let skipped = 0;
    for (const s of stores ?? []) {
      const sid = (s as any).id as string;
      if (data.mode === "missing-only") {
        const [{ count: pCount }, { count: cCount }, { count: bCount }] = await Promise.all([
          supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("store_id", sid),
          supabaseAdmin.from("categories").select("id", { count: "exact", head: true }).eq("store_id", sid),
          supabaseAdmin.from("banners").select("id", { count: "exact", head: true }).eq("store_id", sid),
        ]);
        if ((pCount ?? 0) > 0 || (cCount ?? 0) > 0 || (bCount ?? 0) > 0) {
          skipped++;
          continue;
        }
      } else {
        await wipeStoreChildren(supabaseAdmin, sid);
        await supabaseAdmin.from("stores").update(templateStoreFields(tpl)).eq("id", sid);
      }
      try {
        await seedStoreFromTemplate(supabaseAdmin, sid, tpl);
        updated++;
      } catch {
        skipped++;
      }
    }
    return { ok: true, updated, skipped, total: (stores ?? []).length };
  });

// ============================================================
// Customer accounts (cross-store) — Winner Admin stats
// ============================================================
export const ownerCustomerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [totalRes, activeRes, recentRes, perStoreRes, storesRes] = await Promise.all([
      supabaseAdmin.from("store_customers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("store_customers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin
        .from("store_customers")
        .select("id,full_name,email,phone,store_id,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("store_customers").select("store_id"),
      supabaseAdmin.from("stores").select("id,name,slug"),
    ]);
    const storeMap = new Map<string, { name: string; slug: string }>();
    for (const s of storesRes.data ?? []) storeMap.set((s as any).id, { name: (s as any).name, slug: (s as any).slug });
    const perStore: Record<string, number> = {};
    for (const r of perStoreRes.data ?? []) {
      const sid = (r as any).store_id as string;
      perStore[sid] = (perStore[sid] ?? 0) + 1;
    }
    const byStore = Object.entries(perStore)
      .map(([id, count]) => ({ store_id: id, count, name: storeMap.get(id)?.name ?? id, slug: storeMap.get(id)?.slug ?? "" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
    const recent = (recentRes.data ?? []).map((r: any) => ({
      ...r,
      store_name: storeMap.get(r.store_id)?.name ?? r.store_id,
    }));
    return {
      total: totalRes.count ?? 0,
      active: activeRes.count ?? 0,
      byStore,
      recent,
    };
  });

/** Which AI provider will serve the next request (owner panel diagnostics). */
export const getAiProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { describeActiveAiProvider } = await import("./ai-provider.server");
    return await describeActiveAiProvider();
  });

// ---------------- STORE HEALTH ----------------

/** Per-store operational health for the owner panel. */
export const ownerStoreHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    // Platform-wide aggregate across every tenant: read with the admin client
    // (owner verified above) so per-store RLS does not hide other merchants' rows.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const now = Date.now();


    const [storesRes, ordersRes, productsRes, customersRes, domainsRes] = await Promise.all([
      sb.from("stores").select("id,name,slug,status,subscription_status,expires_at,trial_ends_at,created_at,package_id,merchant_code").order("created_at", { ascending: false }),
      sb.from("orders").select("store_id,created_at,status,subtotal,discount_amount,delivery_amount"),
      sb.from("products").select("store_id,status"),
      sb.from("store_customers").select("store_id,last_login_at"),
      sb.from("store_domains").select("store_id,hostname,status,ssl_status,is_primary"),
    ]);

    type Agg = { orders: number; orders7d: number; revenue: number; lastOrderAt: string | null };
    const orderAgg = new Map<string, Agg>();
    for (const o of (ordersRes.data ?? []) as any[]) {
      const a = orderAgg.get(o.store_id) ?? { orders: 0, orders7d: 0, revenue: 0, lastOrderAt: null };
      a.orders += 1;
      const t = new Date(o.created_at).getTime();
      if (now - t <= 7 * 86400000) a.orders7d += 1;
      if (!["cancelled", "returned"].includes(String(o.status))) {
        a.revenue += Number(o.subtotal || 0) - Number(o.discount_amount || 0) + Number(o.delivery_amount || 0);
      }
      if (!a.lastOrderAt || new Date(a.lastOrderAt).getTime() < t) a.lastOrderAt = o.created_at;
      orderAgg.set(o.store_id, a);
    }

    const productAgg = new Map<string, { total: number; active: number }>();
    for (const p of (productsRes.data ?? []) as any[]) {
      const a = productAgg.get(p.store_id) ?? { total: 0, active: 0 };
      a.total += 1;
      if (p.status === "active") a.active += 1;
      productAgg.set(p.store_id, a);
    }

    const customerAgg = new Map<string, { total: number; lastLoginAt: string | null }>();
    for (const c of (customersRes.data ?? []) as any[]) {
      const a = customerAgg.get(c.store_id) ?? { total: 0, lastLoginAt: null };
      a.total += 1;
      if (c.last_login_at && (!a.lastLoginAt || new Date(a.lastLoginAt) < new Date(c.last_login_at))) {
        a.lastLoginAt = c.last_login_at;
      }
      customerAgg.set(c.store_id, a);
    }

    const domainAgg = new Map<string, { hostname: string; status: string; ssl: string | null }[]>();
    for (const d of (domainsRes.data ?? []) as any[]) {
      const list = domainAgg.get(d.store_id) ?? [];
      list.push({ hostname: d.hostname, status: d.status, ssl: d.ssl_status ?? null });
      domainAgg.set(d.store_id, list);
    }

    const rows = ((storesRes.data ?? []) as any[]).map((s) => {
      const o = orderAgg.get(s.id) ?? { orders: 0, orders7d: 0, revenue: 0, lastOrderAt: null };
      const p = productAgg.get(s.id) ?? { total: 0, active: 0 };
      const c = customerAgg.get(s.id) ?? { total: 0, lastLoginAt: null };
      const domains = domainAgg.get(s.id) ?? [];
      const expiresAt = s.expires_at ?? s.trial_ends_at ?? null;
      const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - now) / 86400000) : null;
      const issues: string[] = [];
      if (s.status === "suspended") issues.push("Store suspended");
      if (["expired", "cancelled", "past_due", "suspended"].includes(String(s.subscription_status))) issues.push("No active plan");
      if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) issues.push(`Plan ends in ${daysLeft}d`);
      if (p.active === 0) issues.push("No active products");
      if (o.orders === 0) issues.push("No orders yet");
      else if (o.orders7d === 0) issues.push("No orders in 7 days");
      if (domains.some((d) => d.status !== "verified" && d.status !== "active")) issues.push("Domain not verified");
      const score = Math.max(0, 100 - issues.length * 18);
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        merchant_code: s.merchant_code ?? null,
        status: s.status,
        subscription_status: s.subscription_status,
        expires_at: expiresAt,
        days_left: daysLeft,
        created_at: s.created_at,
        products: p.total,
        active_products: p.active,
        orders: o.orders,
        orders_7d: o.orders7d,
        revenue: o.revenue,
        last_order_at: o.lastOrderAt,
        customers: c.total,
        last_customer_login_at: c.lastLoginAt,
        domains,
        issues,
        score,
      };
    });

    rows.sort((a, b) => a.score - b.score || b.orders_7d - a.orders_7d);

    return {
      generated_at: new Date().toISOString(),
      totals: {
        stores: rows.length,
        healthy: rows.filter((r) => r.issues.length === 0).length,
        warning: rows.filter((r) => r.issues.length > 0 && r.issues.length <= 2).length,
        critical: rows.filter((r) => r.issues.length > 2).length,
        inactive7d: rows.filter((r) => r.orders_7d === 0).length,
      },
      rows,
    };
  });

// ---------------- AI USAGE ----------------

/** Platform-wide AI consumption analytics (last 90 days). */
export const ownerAiUsageReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const now = Date.now();
    const since = new Date(now - 90 * 86400000).toISOString();

    const [usageRes, storesRes] = await Promise.all([
      sb.from("ai_usage").select("store_id,model,kind,prompt_tokens,completion_tokens,cost_usd,created_at").gte("created_at", since).order("created_at", { ascending: false }),
      sb.from("stores").select("id,name,slug"),
    ]);

    const storeMap = new Map<string, { name: string; slug: string }>();
    for (const s of (storesRes.data ?? []) as any[]) storeMap.set(s.id, { name: s.name, slug: s.slug });

    const rows = ((usageRes.data ?? []) as any[]).map((r) => ({
      ...r,
      tokens: Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0),
      cost: Number(r.cost_usd || 0),
      ts: new Date(r.created_at).getTime(),
    }));

    const window = (days: number) => {
      const from = now - days * 86400000;
      const sel = rows.filter((r) => r.ts >= from);
      return {
        requests: sel.length,
        tokens: sel.reduce((a, r) => a + r.tokens, 0),
        cost: sel.reduce((a, r) => a + r.cost, 0),
      };
    };

    const group = (keyOf: (r: any) => string) => {
      const m = new Map<string, { key: string; requests: number; tokens: number; cost: number }>();
      for (const r of rows.filter((x) => x.ts >= now - 30 * 86400000)) {
        const k = keyOf(r) || "unknown";
        const g = m.get(k) ?? { key: k, requests: 0, tokens: 0, cost: 0 };
        g.requests += 1; g.tokens += r.tokens; g.cost += r.cost;
        m.set(k, g);
      }
      return [...m.values()].sort((a, b) => b.tokens - a.tokens);
    };

    const daily: { date: string; requests: number; tokens: number; cost: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000); d.setHours(0, 0, 0, 0);
      const next = d.getTime() + 86400000;
      const sel = rows.filter((r) => r.ts >= d.getTime() && r.ts < next);
      daily.push({
        date: d.toISOString().slice(0, 10),
        requests: sel.length,
        tokens: sel.reduce((a, r) => a + r.tokens, 0),
        cost: sel.reduce((a, r) => a + r.cost, 0),
      });
    }

    return {
      windows: { d7: window(7), d30: window(30), d90: window(90) },
      byStore: group((r) => r.store_id).map((g) => ({
        ...g,
        name: storeMap.get(g.key)?.name ?? "Platform / unassigned",
        slug: storeMap.get(g.key)?.slug ?? "",
      })),
      byModel: group((r) => r.model),
      byKind: group((r) => r.kind),
      daily,
      recent: rows.slice(0, 50).map((r) => ({
        created_at: r.created_at,
        model: r.model,
        kind: r.kind,
        tokens: r.tokens,
        cost: r.cost,
        store_name: storeMap.get(r.store_id)?.name ?? "—",
      })),
    };
  });

// ---------------- MESSAGE PERFORMANCE (Phase 9 telemetry) ----------------

/** Per-message stage timings for WhatsApp + Messenger replies. */
export const ownerMessagePerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => ({ days: Math.max(1, Math.min(30, Number(d?.days) || 1)) }))
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const cols = "id,store_id,status,created_at,completed_at,processing_ms,last_error,timings";
    const [wa, ms, stores] = await Promise.all([
      sb.from("whatsapp_jobs").select(cols + ",route").gte("created_at", since).neq("status", "merged").order("created_at", { ascending: false }).limit(2000),
      sb.from("messenger_jobs").select(cols).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      sb.from("stores").select("id,name"),
    ]);
    const storeName = new Map<string, string>(((stores.data ?? []) as any[]).map((s) => [s.id, s.name]));
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const rows = [
      ...((wa.data ?? []) as any[]).map((r) => ({ ...r, channel: "whatsapp" })),
      ...((ms.data ?? []) as any[]).map((r) => ({ ...r, channel: "messenger" })),
    ].map((r) => {
      const t = (r.timings ?? {}) as Record<string, unknown>;
      const fallbackTotal = r.completed_at ? new Date(r.completed_at).getTime() - new Date(r.created_at).getTime() : n(r.processing_ms);
      return {
        id: r.id as string,
        channel: r.channel as string,
        store: storeName.get(r.store_id) ?? "—",
        status: r.status as string,
        created_at: r.created_at as string,
        route: (t.route as string) ?? r.route ?? (r.timings ? "other" : "—"),
        model: (t.model as string) ?? null,
        tokens: n(t.tokens) || null,
        error: (r.last_error as string) ?? null,
        traced: !!r.timings,
        queue: n(t.queue_ms), db: n(t.db_ms), ai: n(t.ai_ms), guard: n(t.guard_ms),
        send: n(t.send_ms), photo: n(t.photo_ms), delay: n(t.delay_ms),
        total: n(t.total_ms) || Math.max(0, fallbackTotal),
      };
    });
    const traced = rows.filter((r) => r.traced && r.status === "sent");
    const totals = rows.filter((r) => r.status === "sent").map((r) => r.total).sort((a, b) => a - b);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    const byRoute = new Map<string, typeof traced>();
    for (const r of traced) byRoute.set(r.route, [...(byRoute.get(r.route) ?? []), r]);
    return {
      summary: {
        messages: rows.length,
        sent: totals.length,
        failed: rows.filter((r) => r.status === "failed").length,
        avg: avg(totals),
        p95: totals.length ? totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))] : 0,
        under10: totals.length ? Math.round((totals.filter((x) => x < 10000).length / totals.length) * 100) : 0,
        tracedCount: traced.length,
      },
      breakdown: [...byRoute.entries()].map(([route, rs]) => ({
        route, count: rs.length,
        queue: avg(rs.map((r) => r.queue)), db: avg(rs.map((r) => r.db)), ai: avg(rs.map((r) => r.ai)),
        guard: avg(rs.map((r) => r.guard)), send: avg(rs.map((r) => r.send)), photo: avg(rs.map((r) => r.photo)),
        delay: avg(rs.map((r) => r.delay)),
      })),
      slowest: [...rows].sort((a, b) => b.total - a.total).slice(0, 50),
      stores: [...new Set(rows.map((r) => r.store))].sort(),
    };
  });


/** Token usage + remaining balance per connected AI key (owner only, no secrets). */
export const listAiKeyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { helpers, keys } = await loadGeminiKeys(sb);
    const usage = await import("@/lib/ai-key-usage.server");
    // Refresh OpenRouter balances at most every 5 minutes.
    const { data: q0 } = await sb.from("ai_key_quota").select("*");
    const quota0 = new Map<string, any>(((q0 as any[]) ?? []).map((r) => [r.key_id, r]));
    const stale = keys.filter((k) => k.provider === "openrouter" && (!quota0.get(k.id) || Date.now() - new Date(quota0.get(k.id).checked_at).getTime() > 300_000));
    if (stale.length) await Promise.all(stale.map((k) => usage.refreshOpenRouterQuota(k.id, k.key)));
    const { data: q1 } = stale.length ? await sb.from("ai_key_quota").select("*") : { data: q0 };
    const quota = new Map<string, any>(((q1 as any[]) ?? []).map((r) => [r.key_id, r]));
    const totals = await usage.loadKeyTotals(sb);
    const rows = keys.map((k, i) => {
      const t = totals[k.id] ?? { today: 0, month: 0, requests: 0, last: null };
      const q = quota.get(k.id);
      const daily = k.daily_token_limit ?? null;
      const monthly = k.monthly_token_limit ?? null;
      let remaining: number | null = null;
      let limit: number | null = null;
      let unit = "tokens";
      let source: "provider" | "limit" | "none" = "none";
      let period: "day" | "month" | null = null;
      if (q && q.remaining_tokens !== null && q.remaining_tokens !== undefined) {
        remaining = Number(q.remaining_tokens);
        limit = q.limit_tokens !== null ? Number(q.limit_tokens) : null;
        unit = q.unit;
        source = "provider";
      } else if (daily) {
        limit = daily; remaining = Math.max(0, daily - t.today); source = "limit"; period = "day";
      } else if (monthly) {
        limit = monthly; remaining = Math.max(0, monthly - t.month); source = "limit"; period = "month";
      }
      const over = (!!daily && t.today >= daily) || (!!monthly && t.month >= monthly);
      return {
        id: k.id, order: i + 1, label: k.label, provider: k.provider,
        provider_name: helpers.providerPreset(k.provider).name, enabled: k.enabled,
        used_today: t.today, used_month: t.month, requests_month: t.requests, last_used: t.last,
        remaining, limit, unit, source, period, over_limit: over,
        reset_at: q?.reset_at ?? null, checked_at: q?.checked_at ?? null,
      };
    });
    return {
      keys: rows,
      total_today: rows.reduce((a, r) => a + r.used_today, 0),
      total_month: rows.reduce((a, r) => a + r.used_month, 0),
    };
  });

export const playgroundChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ids: z.array(z.string().min(1)).min(1).max(30),
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20),
      histories: z.record(z.string(), z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20)).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { keys } = await loadGeminiKeys(context.supabase as any);
    const { chatWithSavedKey } = await import("./ai-provider.server");
    const results = await Promise.all(
      data.ids.map(async (id) => {
        const k = keys.find((x: any) => x.id === id);
        if (!k) return { id, ok: false, error: "Key not found", ms: 0 };
        const hist = data.histories?.[id];
        const msgs = hist ? [...hist, data.messages[data.messages.length - 1]] : data.messages;
        return { id, ...(await chatWithSavedKey(k, msgs.filter((m) => m.content))) };
      }),
    );
    return { results };
  });
