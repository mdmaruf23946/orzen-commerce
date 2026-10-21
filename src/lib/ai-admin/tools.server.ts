import { addCalendarMonths, daysToMonths } from "@/lib/plan-period";
// Allow-listed action layer for the AI Admin Control agent.
// The agent NEVER touches the database directly — every capability is one of
// these handlers, each with a Zod schema, a risk level and a permission key.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ACTION_BY_KEY, type ActionRisk } from "./catalog";

type Sb = typeof supabaseAdmin;

export type ToolDef = {
  key: string;
  description: string;
  schema: z.ZodTypeAny;
  risk: ActionRisk;
  /** Human summary used in confirmation prompts. */
  summary: (args: any) => string;
  run: (sb: Sb, args: any) => Promise<unknown>;
};

const dayStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

const money = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-US")}`;

async function findStore(sb: Sb, query: string) {
  const q = query.trim();
  const { data } = await sb
    .from("stores")
    .select("id, name, slug, owner_name, email, phone, status, subscription_status, package_id, created_at, expires_at")
    .or(
      [
        `name.ilike.%${q}%`,
        `slug.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `owner_name.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
      ].join(","),
    )
    .limit(5);
  return data ?? [];
}

async function requireStore(sb: Sb, query: string) {
  const rows = await findStore(sb, query);
  if (rows.length === 0) throw new Error(`No user/store matched "${query}".`);
  if (rows.length > 1) {
    const names = rows.map((r) => `${r.name} (${r.slug})`).join(", ");
    throw new Error(`Multiple matches: ${names}. Ask which one.`);
  }
  return rows[0]!;
}

const str = z.object({ query: z.string() });
const empty = z.object({});

export const TOOLS: ToolDef[] = [
  // ---------------- Analytics ----------------
  {
    key: "stats_today_users",
    description: "Count of stores/users registered today.",
    schema: empty,
    risk: "low",
    summary: () => "Read today's new users",
    run: async (sb) => {
      const { count } = await sb
        .from("stores")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart());
      return { new_users_today: count ?? 0 };
    },
  },
  {
    key: "stats_today_orders",
    description: "Count and total value of orders placed today across all stores.",
    schema: empty,
    risk: "low",
    summary: () => "Read today's orders",
    run: async (sb) => {
      const { data } = await sb.from("orders").select("subtotal, delivery_amount, discount_amount").gte("created_at", dayStart());
      const rows = data ?? [];
      const total = rows.reduce(
        (a, r) => a + Number(r.subtotal ?? 0) + Number(r.delivery_amount ?? 0) - Number(r.discount_amount ?? 0),
        0,
      );
      return { orders_today: rows.length, value_today: total };
    },
  },
  {
    key: "stats_today_revenue",
    description: "Platform subscription revenue collected today (paid payments).",
    schema: empty,
    risk: "low",
    summary: () => "Read today's revenue",
    run: async (sb) => {
      const { data } = await sb.from("payments").select("amount").eq("status", "paid").gte("created_at", dayStart());
      return { revenue_today: (data ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0) };
    },
  },
  {
    key: "stats_subscriptions",
    description: "Subscription status breakdown across all stores.",
    schema: empty,
    risk: "low",
    summary: () => "Read subscription statistics",
    run: async (sb) => {
      const { data } = await sb.from("stores").select("subscription_status");
      const out: Record<string, number> = {};
      for (const r of data ?? []) out[r.subscription_status ?? "unknown"] = (out[r.subscription_status ?? "unknown"] ?? 0) + 1;
      return out;
    },
  },
  {
    key: "stats_active_users",
    description: "Count of active stores on the platform.",
    schema: empty,
    risk: "low",
    summary: () => "Read active users",
    run: async (sb) => {
      const { count } = await sb.from("stores").select("*", { count: "exact", head: true }).eq("status", "active");
      return { active_stores: count ?? 0 };
    },
  },
  {
    key: "stats_pending_payments",
    description: "Count and list of subscription payments awaiting verification.",
    schema: empty,
    risk: "low",
    summary: () => "Read pending payments",
    run: async (sb) => {
      const { data } = await sb
        .from("payments")
        .select("id, amount, method, txn_id, invoice_no, created_at, stores(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      return { pending: data ?? [] };
    },
  },
  {
    key: "stats_pending_subscriptions",
    description: "Stores whose subscription is pending approval.",
    schema: empty,
    risk: "low",
    summary: () => "Read pending subscriptions",
    run: async (sb) => {
      const { data } = await sb
        .from("stores")
        .select("id, name, slug, subscription_status, created_at")
        .eq("subscription_status", "pending")
        .limit(20);
      return { pending: data ?? [] };
    },
  },

  // ---------------- Users ----------------
  {
    key: "user_search",
    description: "Search platform users/stores by name, slug, email, owner name or phone.",
    schema: str,
    risk: "low",
    summary: (a) => `Search users for "${a.query}"`,
    run: async (sb, a) => ({ matches: await findStore(sb, a.query) }),
  },
  {
    key: "user_details",
    description: "Full details of one user/store.",
    schema: str,
    risk: "low",
    summary: (a) => `View details of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const [{ count: products }, { count: orders }] = await Promise.all([
        sb.from("products").select("*", { count: "exact", head: true }).eq("store_id", s.id),
        sb.from("orders").select("*", { count: "exact", head: true }).eq("store_id", s.id),
      ]);
      return { ...s, products, orders };
    },
  },
  {
    key: "user_subscription",
    description: "Current plan and subscription state of a user/store.",
    schema: str,
    risk: "low",
    summary: (a) => `View subscription of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data: pkg } = s.package_id
        ? await sb.from("subscription_packages").select("name, price, billing_cycle").eq("id", s.package_id).maybeSingle()
        : { data: null };
      return { store: s.name, plan: pkg?.name ?? "Free", status: s.subscription_status, expires_at: s.expires_at };
    },
  },
  {
    key: "user_activity",
    description: "Recent orders of a user/store as an activity snapshot.",
    schema: str,
    risk: "low",
    summary: (a) => `View activity of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data } = await sb
        .from("orders")
        .select("invoice_no, status, subtotal, created_at")
        .eq("store_id", s.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return { store: s.name, recent_orders: data ?? [] };
    },
  },
  {
    key: "user_change_plan",
    description: "Change a user's subscription package by plan name.",
    schema: z.object({ query: z.string(), plan: z.string() }),
    risk: "medium",
    summary: (a) => `Change plan of ${a.query} to "${a.plan}"`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data: pkg } = await sb
        .from("subscription_packages")
        .select("id, name, duration_days")
        .ilike("name", `%${a.plan}%`)
        .limit(1)
        .maybeSingle();
      if (!pkg) throw new Error(`No plan matched "${a.plan}".`);
      const expires = addCalendarMonths(new Date(), daysToMonths(pkg.duration_days)).toISOString();
      const { error } = await sb
        .from("stores")
        .update({ package_id: pkg.id, subscription_status: "active", expires_at: expires })
        .eq("id", s.id);
      if (error) throw new Error(error.message);
      return { store: s.name, plan: pkg.name, expires_at: expires };
    },
  },
  {
    key: "user_suspend",
    description: "Suspend a user's store.",
    schema: str,
    risk: "medium",
    summary: (a) => `Suspend ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { error } = await sb.from("stores").update({ status: "suspended" }).eq("id", s.id);
      if (error) throw new Error(error.message);
      return { store: s.name, status: "suspended" };
    },
  },
  {
    key: "user_activate",
    description: "Activate a suspended store.",
    schema: str,
    risk: "medium",
    summary: (a) => `Activate ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { error } = await sb.from("stores").update({ status: "active" }).eq("id", s.id);
      if (error) throw new Error(error.message);
      return { store: s.name, status: "active" };
    },
  },

  // ---------------- Subscriptions ----------------
  {
    key: "subscription_view",
    description: "View a store subscription record.",
    schema: str,
    risk: "low",
    summary: (a) => `View subscription record of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data } = await sb
        .from("store_subscriptions")
        .select("subscription_no, plan_name, status, price, billing_cycle, expires_at, created_at")
        .eq("store_id", s.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return { store: s.name, subscriptions: data ?? [] };
    },
  },
  {
    key: "subscription_pending_list",
    description: "List subscription payments/stores awaiting approval.",
    schema: empty,
    risk: "low",
    summary: () => "List pending subscriptions",
    run: async (sb) => {
      const { data } = await sb
        .from("payments")
        .select("id, amount, method, txn_id, created_at, stores(name, slug)")
        .eq("status", "pending")
        .eq("purpose", "subscription")
        .order("created_at", { ascending: false })
        .limit(20);
      return { pending: data ?? [] };
    },
  },
  {
    key: "subscription_approve",
    description: "Approve the latest pending subscription payment of a store and activate its plan.",
    schema: str,
    risk: "medium",
    summary: (a) => `Approve pending subscription of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data: pay } = await sb
        .from("payments")
        .select("id, amount, package_id")
        .eq("store_id", s.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pay) throw new Error(`No pending payment for ${s.name}.`);
      await sb.from("payments").update({ status: "paid", verified_at: new Date().toISOString() }).eq("id", pay.id);
      const patch: {
        subscription_status: string;
        package_id?: string;
        expires_at?: string;
      } = { subscription_status: "active" };
      if (pay.package_id) {
        const { data: pkg } = await sb
          .from("subscription_packages")
          .select("id, duration_days")
          .eq("id", pay.package_id)
          .maybeSingle();
        patch.package_id = pay.package_id;
        patch.expires_at = new Date(Date.now() + (pkg?.duration_days || 30) * 86400000).toISOString();
      }
      await sb.from("stores").update(patch).eq("id", s.id);
      return { store: s.name, approved_amount: money(pay.amount) };
    },
  },
  {
    key: "subscription_reject",
    description: "Reject the latest pending subscription payment of a store with a reason.",
    schema: z.object({ query: z.string(), reason: z.string() }),
    risk: "medium",
    summary: (a) => `Reject pending subscription of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data: pay } = await sb
        .from("payments")
        .select("id")
        .eq("store_id", s.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pay) throw new Error(`No pending payment for ${s.name}.`);
      await sb.from("payments").update({ status: "rejected", rejection_reason: a.reason }).eq("id", pay.id);
      return { store: s.name, rejected: true, reason: a.reason };
    },
  },
  {
    key: "subscription_change_plan",
    description: "Change the plan of a store subscription (same as changing the user's plan).",
    schema: z.object({ query: z.string(), plan: z.string() }),
    risk: "medium",
    summary: (a) => `Change subscription plan of ${a.query} to "${a.plan}"`,
    run: async (sb, a) => {
      const tool = TOOLS.find((t) => t.key === "user_change_plan")!;
      return tool.run(sb, a);
    },
  },
  {
    key: "subscription_cancel",
    description: "Cancel a store's subscription (marks it cancelled, store stays active until expiry).",
    schema: str,
    risk: "medium",
    summary: (a) => `Cancel subscription of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      await sb.from("stores").update({ subscription_status: "cancelled" }).eq("id", s.id);
      await sb
        .from("store_subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("store_id", s.id)
        .eq("status", "active");
      return { store: s.name, subscription_status: "cancelled" };
    },
  },
  {
    key: "subscription_renew",
    description: "Renew a store's current plan for another billing period.",
    schema: str,
    risk: "medium",
    summary: (a) => `Renew subscription of ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { data: pkg } = s.package_id
        ? await sb.from("subscription_packages").select("duration_days, name").eq("id", s.package_id).maybeSingle()
        : { data: null };
      const base = s.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
      const expires = addCalendarMonths(base, daysToMonths(pkg?.duration_days)).toISOString();
      await sb
        .from("stores")
        .update({ subscription_status: "active", expires_at: expires, last_renewed_at: new Date().toISOString() })
        .eq("id", s.id);
      return { store: s.name, plan: pkg?.name ?? "current plan", expires_at: expires };
    },
  },

  // ---------------- Payments ----------------
  {
    key: "payment_search",
    description: "Search a subscription payment by transaction id or invoice number.",
    schema: str,
    risk: "low",
    summary: (a) => `Search payments for "${a.query}"`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("payments")
        .select("id, amount, status, method, txn_id, invoice_no, created_at, stores(name)")
        .or(`txn_id.ilike.%${a.query}%,invoice_no.ilike.%${a.query}%`)
        .limit(10);
      return { matches: data ?? [] };
    },
  },
  {
    key: "payment_details",
    description: "Details of one payment by transaction id or invoice number.",
    schema: str,
    risk: "low",
    summary: (a) => `View payment ${a.query}`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("payments")
        .select("*, stores(name, slug)")
        .or(`txn_id.eq.${a.query},invoice_no.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!data) throw new Error(`No payment matched "${a.query}".`);
      return data;
    },
  },
  {
    key: "payment_pending_list",
    description: "List payments awaiting verification.",
    schema: empty,
    risk: "low",
    summary: () => "List pending payments",
    run: async (sb) => {
      const { data } = await sb
        .from("payments")
        .select("id, amount, method, txn_id, created_at, stores(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      return { pending: data ?? [] };
    },
  },
  {
    key: "payment_today",
    description: "Payments received today.",
    schema: empty,
    risk: "low",
    summary: () => "List today's payments",
    run: async (sb) => {
      const { data } = await sb
        .from("payments")
        .select("amount, status, method, txn_id, created_at, stores(name)")
        .gte("created_at", dayStart())
        .order("created_at", { ascending: false })
        .limit(50);
      return { payments: data ?? [] };
    },
  },
  {
    key: "payment_approve",
    description: "Approve a pending payment by transaction id or invoice number.",
    schema: str,
    risk: "medium",
    summary: (a) => `Approve payment ${a.query}`,
    run: async (sb, a) => {
      const { data: pay } = await sb
        .from("payments")
        .select("id, store_id, amount, package_id, status")
        .or(`txn_id.eq.${a.query},invoice_no.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!pay) throw new Error(`No payment matched "${a.query}".`);
      if (pay.status === "paid") return { already_approved: true, amount: money(pay.amount) };
      await sb.from("payments").update({ status: "paid", verified_at: new Date().toISOString() }).eq("id", pay.id);
      if (pay.package_id) {
        const { data: pkg } = await sb
          .from("subscription_packages")
          .select("duration_days")
          .eq("id", pay.package_id)
          .maybeSingle();
        await sb
          .from("stores")
          .update({
            package_id: pay.package_id,
            subscription_status: "active",
            expires_at: new Date(Date.now() + (pkg?.duration_days || 30) * 86400000).toISOString(),
          })
          .eq("id", pay.store_id);
      }
      return { approved: true, amount: money(pay.amount) };
    },
  },
  {
    key: "payment_reject",
    description: "Reject a pending payment by transaction id or invoice number, with a reason.",
    schema: z.object({ query: z.string(), reason: z.string() }),
    risk: "medium",
    summary: (a) => `Reject payment ${a.query}`,
    run: async (sb, a) => {
      const { data: pay } = await sb
        .from("payments")
        .select("id")
        .or(`txn_id.eq.${a.query},invoice_no.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!pay) throw new Error(`No payment matched "${a.query}".`);
      await sb.from("payments").update({ status: "rejected", rejection_reason: a.reason }).eq("id", pay.id);
      return { rejected: true, reason: a.reason };
    },
  },
  {
    key: "payment_refund",
    description: "Mark a payment as refunded. High risk.",
    schema: z.object({ query: z.string(), reason: z.string() }),
    risk: "high",
    summary: (a) => `REFUND payment ${a.query}`,
    run: async (sb, a) => {
      const { data: pay } = await sb
        .from("payments")
        .select("id, amount")
        .or(`txn_id.eq.${a.query},invoice_no.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!pay) throw new Error(`No payment matched "${a.query}".`);
      await sb.from("payments").update({ status: "refunded", notes: `Refund: ${a.reason}` }).eq("id", pay.id);
      return { refunded: true, amount: money(pay.amount) };
    },
  },

  // ---------------- Orders ----------------
  {
    key: "order_search",
    description: "Search orders by invoice number, customer phone or customer name.",
    schema: str,
    risk: "low",
    summary: (a) => `Search orders for "${a.query}"`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("orders")
        .select("id, invoice_no, customer_name, phone, status, subtotal, created_at, stores(name)")
        .or(`invoice_no.ilike.%${a.query}%,phone.ilike.%${a.query}%,customer_name.ilike.%${a.query}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      return { matches: data ?? [] };
    },
  },
  {
    key: "order_details",
    description: "Full details of one order by invoice number.",
    schema: str,
    risk: "low",
    summary: (a) => `View order ${a.query}`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("orders")
        .select("*, order_items(*), stores(name)")
        .eq("invoice_no", a.query)
        .limit(1)
        .maybeSingle();
      if (!data) throw new Error(`No order matched "${a.query}".`);
      return data;
    },
  },
  {
    key: "order_pending_list",
    description: "Orders that are still pending across the platform.",
    schema: empty,
    risk: "low",
    summary: () => "List pending orders",
    run: async (sb) => {
      const { data } = await sb
        .from("orders")
        .select("invoice_no, customer_name, subtotal, created_at, stores(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      return { pending: data ?? [] };
    },
  },
  {
    key: "order_today",
    description: "Orders placed today.",
    schema: empty,
    risk: "low",
    summary: () => "List today's orders",
    run: async (sb) => {
      const { data } = await sb
        .from("orders")
        .select("invoice_no, customer_name, status, subtotal, created_at, stores(name)")
        .gte("created_at", dayStart())
        .order("created_at", { ascending: false })
        .limit(50);
      return { orders: data ?? [] };
    },
  },
  {
    key: "order_change_status",
    description: "Change an order's status. Allowed: pending, confirmed, processing, delivered, cancelled.",
    schema: z.object({
      query: z.string(),
      status: z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]),
    }),
    risk: "medium",
    summary: (a) => `Set order ${a.query} to ${a.status}`,
    run: async (sb, a) => {
      const { data: order } = await sb.from("orders").select("id, invoice_no").eq("invoice_no", a.query).limit(1).maybeSingle();
      if (!order) throw new Error(`No order matched "${a.query}".`);
      const { error } = await sb.from("orders").update({ status: a.status }).eq("id", order.id);
      if (error) throw new Error(error.message);
      return { invoice_no: order.invoice_no, status: a.status };
    },
  },

  // ---------------- Products ----------------
  {
    key: "product_search",
    description: "Search products by name or SKU across all stores.",
    schema: str,
    risk: "low",
    summary: (a) => `Search products for "${a.query}"`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("products")
        .select("id, name, sku, price, stock, status, stores(name)")
        .or(`name.ilike.%${a.query}%,sku.ilike.%${a.query}%`)
        .limit(10);
      return { matches: data ?? [] };
    },
  },
  {
    key: "product_details",
    description: "Details of one product by name or SKU.",
    schema: str,
    risk: "low",
    summary: (a) => `View product ${a.query}`,
    run: async (sb, a) => {
      const { data } = await sb
        .from("products")
        .select("id, name, sku, price, old_price, cost_price, stock, status, total_sold, stores(name)")
        .or(`name.ilike.%${a.query}%,sku.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!data) throw new Error(`No product matched "${a.query}".`);
      return data;
    },
  },
  {
    key: "product_update_price",
    description: "Update a product's price.",
    schema: z.object({ query: z.string(), price: z.number() }),
    risk: "medium",
    summary: (a) => `Set price of ${a.query} to ${money(a.price)}`,
    run: async (sb, a) => {
      const { data: p } = await sb
        .from("products")
        .select("id, name")
        .or(`name.ilike.%${a.query}%,sku.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!p) throw new Error(`No product matched "${a.query}".`);
      const { error } = await sb.from("products").update({ price: a.price }).eq("id", p.id);
      if (error) throw new Error(error.message);
      return { product: p.name, price: a.price };
    },
  },
  {
    key: "product_set_status",
    description: "Enable or disable a product (active / draft / out_of_stock).",
    schema: z.object({ query: z.string(), status: z.enum(["active", "draft", "out_of_stock"]) }),
    risk: "medium",
    summary: (a) => `Set ${a.query} status to ${a.status}`,
    run: async (sb, a) => {
      const { data: p } = await sb
        .from("products")
        .select("id, name")
        .or(`name.ilike.%${a.query}%,sku.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!p) throw new Error(`No product matched "${a.query}".`);
      const { error } = await sb.from("products").update({ status: a.status }).eq("id", p.id);
      if (error) throw new Error(error.message);
      return { product: p.name, status: a.status };
    },
  },
  {
    key: "product_update_stock",
    description: "Set a product's stock quantity.",
    schema: z.object({ query: z.string(), stock: z.number().int() }),
    risk: "medium",
    summary: (a) => `Set stock of ${a.query} to ${a.stock}`,
    run: async (sb, a) => {
      const { data: p } = await sb
        .from("products")
        .select("id, name")
        .or(`name.ilike.%${a.query}%,sku.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!p) throw new Error(`No product matched "${a.query}".`);
      const { error } = await sb.from("products").update({ stock: a.stock }).eq("id", p.id);
      if (error) throw new Error(error.message);
      return { product: p.name, stock: a.stock };
    },
  },
  {
    key: "product_delete",
    description: "Permanently delete a product. High risk.",
    schema: str,
    risk: "high",
    summary: (a) => `DELETE product ${a.query}`,
    run: async (sb, a) => {
      const { data: p } = await sb
        .from("products")
        .select("id, name")
        .or(`name.ilike.%${a.query}%,sku.eq.${a.query}`)
        .limit(1)
        .maybeSingle();
      if (!p) throw new Error(`No product matched "${a.query}".`);
      const { error } = await sb.from("products").delete().eq("id", p.id);
      if (error) throw new Error(error.message);
      return { deleted: p.name };
    },
  },

  // ---------------- Restricted ----------------
  {
    key: "user_delete",
    description: "Permanently delete a user's store and all its data. Highest risk.",
    schema: str,
    risk: "high",
    summary: (a) => `DELETE store/user ${a.query}`,
    run: async (sb, a) => {
      const s = await requireStore(sb, a.query);
      const { error } = await sb.from("stores").delete().eq("id", s.id);
      if (error) throw new Error(error.message);
      return { deleted: s.name };
    },
  },
  {
    key: "admin_manage",
    description: "Enable or disable an AI Admin action permission.",
    schema: z.object({ action_key: z.string(), enabled: z.boolean() }),
    risk: "high",
    summary: (a) => `${a.enabled ? "Enable" : "Disable"} permission ${a.action_key}`,
    run: async (sb, a) => {
      if (!ACTION_BY_KEY[a.action_key]) throw new Error(`Unknown action ${a.action_key}`);
      const meta = ACTION_BY_KEY[a.action_key]!;
      const { error } = await sb
        .from("ai_admin_permissions")
        .upsert(
          { action_key: a.action_key, group_key: meta.group, risk: meta.risk, enabled: a.enabled },
          { onConflict: "action_key" },
        );
      if (error) throw new Error(error.message);
      return { action_key: a.action_key, enabled: a.enabled };
    },
  },

  // ---------------- Human support relay ----------------
  {
    key: "support_open_list",
    description:
      "List the Messenger customers who asked to talk to a human and are waiting for the owner's reply.",
    schema: empty,
    risk: "low",
    summary: () => "List customers waiting for human support",
    run: async () => {
      const { listOpenSupport } = await import("./support-relay.server");
      return { waiting: await listOpenSupport() };
    },
  },
  {
    key: "support_history",
    description:
      "Read the recent Messenger conversation with a waiting customer. Optional 'customer' = their name or Messenger ID; omit it for the most recent one.",
    schema: z.object({ customer: z.string().nullable() }),
    risk: "low",
    summary: (a) => `Read support conversation ${a?.customer ?? "(latest)"}`,
    run: async (_sb, a) => {
      const { supportHistory } = await import("./support-relay.server");
      return supportHistory(a?.customer ?? null);
    },
  },
  {
    key: "support_reply",
    description:
      "Send a message to the waiting Messenger customer on the owner's behalf. Put the final, polite customer-facing wording in 'message'. Optional 'customer' = their name or Messenger ID; omit it for the most recent one.",
    schema: z.object({ message: z.string(), customer: z.string().nullable() }),
    risk: "low",
    summary: (a) => `Reply to customer ${a?.customer ?? "(latest)"}`,
    run: async (_sb, a) => {
      const { relayToCustomer } = await import("./support-relay.server");
      return relayToCustomer({ hint: a?.customer ?? null, message: a.message });
    },
  },
  {
    key: "support_close",
    description:
      "Mark the human support conversation finished and hand the customer back to the AI agent.",
    schema: z.object({ customer: z.string().nullable(), note: z.string().nullable() }),
    risk: "low",
    summary: (a) => `Close support conversation ${a?.customer ?? "(latest)"}`,
    run: async (_sb, a) => {
      const { closeSupport } = await import("./support-relay.server");
      return closeSupport(a?.customer ?? null, a?.note ?? null);
    },
  },

];

export const TOOL_BY_KEY: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.key, t]));

/** Permission map merged with catalog defaults. */
export async function loadPermissions(sb: Sb): Promise<Record<string, boolean>> {
  const { data } = await sb.from("ai_admin_permissions").select("action_key, enabled");
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(ACTION_BY_KEY)) out[key] = ACTION_BY_KEY[key]!.defaultEnabled;
  for (const row of data ?? []) out[row.action_key] = row.enabled;
  return out;
}

export async function logAction(
  sb: Sb,
  entry: {
    action_key: string;
    risk: string;
    command?: string | null;
    args?: unknown;
    result?: "success" | "failed" | "blocked" | "cancelled";
    result_detail?: string | null;
    target_label?: string | null;
    channel?: string;
    actor?: string | null;
  },
) {
  await sb.from("ai_admin_action_logs").insert({
    action_key: entry.action_key,
    risk: entry.risk,
    command: entry.command ?? null,
    args: (entry.args ?? {}) as never,
    result: entry.result ?? "success",
    result_detail: entry.result_detail ?? null,
    target_label: entry.target_label ?? null,
    channel: entry.channel ?? "whatsapp",
    actor: entry.actor ?? null,
  });
}
