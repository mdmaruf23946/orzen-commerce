// Store-admin customer CRM server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const listInput = z.object({
  search: z.string().max(120).optional(),
  filter: z
    .enum(["all", "new", "returning", "vip", "blocked", "pending", "returns", "exchanges"])
    .default("all"),
  sort: z.enum(["newest", "spend", "orders", "last", "alpha"]).default("last"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(200).default(25),
});

const keyInput = z.object({ key: z.string().min(1).max(120) });

export const listStoreCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/customers-admin.server");
    const storeId = await s.ownerStoreId(context.supabase, context.userId);
    const empty = {
      rows: [] as Awaited<ReturnType<typeof s.buildCustomers>>,
      total: 0,
      summary: {
        total: 0,
        newToday: 0,
        newMonth: 0,
        returning: 0,
        vip: 0,
        revenue: 0,
        aov: 0,
      },
    };
    if (!storeId) return empty;

    const [orders, accounts, returns, notesRes] = await Promise.all([
      s.loadOrders(context.supabase, storeId),
      s.loadAccounts(context.supabase, storeId),
      s.loadReturns(context.supabase, storeId),
      context.supabase.from("customer_notes").select("customer_phone,tags").eq("store_id", storeId),
    ]);

    const all = s.buildCustomers({
      orders,
      accounts,
      returns,
      notes: (notesRes.data ?? []) as any[],
    });

    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const since = (c: (typeof all)[number]) => c.joined ?? c.firstOrder ?? "";
    const revenue = all.reduce((a, c) => a + c.spend, 0);
    const orderCount = all.reduce((a, c) => a + c.orders, 0);
    const summary = {
      total: all.length,
      newToday: all.filter((c) => since(c) >= startDay).length,
      newMonth: all.filter((c) => since(c) >= startMonth).length,
      returning: all.filter((c) => c.orders >= 2).length,
      vip: all.filter((c) => c.status === "vip").length,
      revenue,
      aov: orderCount ? revenue / orderCount : 0,
    };

    const q = (data.search ?? "").trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, "");
    let matchedKeys: Set<string> | null = null;
    if (q) {
      matchedKeys = new Set<string>();
      for (const o of orders) {
        const inv = String(o.invoice_no ?? "").toLowerCase();
        if (inv.includes(q) || o.id.toLowerCase().startsWith(q)) {
          const k = s.customerKey(o.phone, o.email);
          if (k) matchedKeys.add(k);
        }
      }
    }

    let rows = all.filter((c) => {
      if (q) {
        const hit =
          c.name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (digits.length >= 3 && s.normalizePhone(c.phone).includes(digits)) ||
          matchedKeys!.has(c.key);
        if (!hit) return false;
      }
      switch (data.filter) {
        case "new":
          return c.status === "new";
        case "returning":
          return c.orders >= 2;
        case "vip":
          return c.status === "vip";
        case "blocked":
          return c.blocked;
        case "pending":
          return c.pending > 0;
        case "returns":
          return c.returns > 0;
        case "exchanges":
          return c.exchanges > 0;
        default:
          return true;
      }
    });

    rows.sort((a, b) => {
      switch (data.sort) {
        case "newest":
          return (b.joined ?? b.firstOrder ?? "").localeCompare(a.joined ?? a.firstOrder ?? "");
        case "spend":
          return b.spend - a.spend;
        case "orders":
          return b.orders - a.orders;
        case "alpha":
          return a.name.localeCompare(b.name);
        default:
          return (b.lastOrder ?? "").localeCompare(a.lastOrder ?? "");
      }
    });

    const total = rows.length;
    const start = (data.page - 1) * data.pageSize;
    return { rows: rows.slice(start, start + data.pageSize), total, summary };
  });

export const exportStoreCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listInput.omit({ page: true, pageSize: true }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/customers-admin.server");
    const storeId = await s.ownerStoreId(context.supabase, context.userId);
    if (!storeId) return { header: [], rows: [] as Record<string, any>[] };
    const [orders, accounts, returns, notesRes] = await Promise.all([
      s.loadOrders(context.supabase, storeId),
      s.loadAccounts(context.supabase, storeId),
      s.loadReturns(context.supabase, storeId),
      context.supabase.from("customer_notes").select("customer_phone,tags").eq("store_id", storeId),
    ]);
    const all = s.buildCustomers({ orders, accounts, returns, notes: (notesRes.data ?? []) as any[] });
    const q = (data.search ?? "").trim().toLowerCase();
    const rows = all
      .filter((c) => (q ? c.name.toLowerCase().includes(q) || s.normalizePhone(c.phone).includes(q.replace(/\D/g, "")) : true))
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email ?? "",
        orders: c.orders,
        spend: Math.round(c.spend),
        status: c.status,
        last_order: c.lastOrder ?? "",
        tags: c.tags.join("|"),
      }));
    return {
      header: ["name", "phone", "email", "orders", "spend", "status", "last_order", "tags"],
      rows,
    };
  });

export const getCustomerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => keyInput.parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/customers-admin.server");
    const storeId = await s.ownerStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("No store");

    const [orders, accounts, returns, notesRes] = await Promise.all([
      s.loadOrders(context.supabase, storeId),
      s.loadAccounts(context.supabase, storeId),
      s.loadReturns(context.supabase, storeId),
      context.supabase.from("customer_notes").select("customer_phone,tags,note").eq("store_id", storeId),
    ]);

    const mine = orders.filter((o) => s.customerKey(o.phone, o.email) === data.key);
    const account = accounts.find((a) => s.customerKey(a.phone, a.email) === data.key) ?? null;
    const phones = new Set(mine.map((o) => s.normalizePhone(o.phone)).filter(Boolean));
    if (account?.phone) phones.add(s.normalizePhone(account.phone));
    const orderIds = new Set(mine.map((o) => o.id));
    const myReturns = returns.filter(
      (r) => (r.order_id && orderIds.has(r.order_id)) || phones.has(s.normalizePhone(r.phone)),
    );

    const summaryRow = s
      .buildCustomers({ orders: mine, accounts: account ? [account] : [], returns: myReturns, notes: [] })
      .find((c) => c.key === data.key);

    const note =
      (notesRes.data ?? []).find(
        (n: any) => phones.has(s.normalizePhone(n.customer_phone)),
      ) ?? null;

    // Saved account addresses + unique order addresses.
    let addresses: any[] = [];
    if (account) {
      const { data: addr } = await context.supabase
        .from("store_customer_addresses")
        .select("id,label,name,phone,address,area,is_default")
        .eq("store_id", storeId)
        .eq("customer_id", account.id);
      addresses = addr ?? [];
    }
    const seen = new Set(addresses.map((a) => `${a.address}|${a.area ?? ""}`));
    const orderAddresses = mine
      .filter((o) => o.address && !seen.has(`${o.address}|${o.area ?? ""}`))
      .filter((o) => {
        const k = `${o.address}|${o.area ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((o) => ({ address: o.address, area: o.area, from: o.created_at }));

    const spendNoCancel = mine
      .filter((o) => o.status !== "cancelled")
      .reduce((a, o) => a + Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0), 0);

    const stats = {
      total: mine.length,
      delivered: mine.filter((o) => o.status === "delivered").length,
      pending: mine.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
      cancelled: mine.filter((o) => o.status === "cancelled").length,
      returned: myReturns.filter((r) => r.type !== "exchange").length,
      exchanged: myReturns.filter((r) => r.type === "exchange").length,
      refunded: myReturns.filter((r) => r.status === "refunded" || r.refund_status === "paid").length,
      spend: spendNoCancel,
      aov: mine.length ? spendNoCancel / mine.length : 0,
      discount: mine.reduce((a, o) => a + Number(o.discount_amount ?? 0), 0),
      lastPurchase: mine[0]?.created_at ?? null,
      firstPurchase: mine.length ? mine[mine.length - 1].created_at : null,
    };

    const freq = (() => {
      if (mine.length < 2 || !stats.firstPurchase || !stats.lastPurchase) return null;
      const days = (Date.parse(stats.lastPurchase) - Date.parse(stats.firstPurchase)) / 86400000;
      if (days <= 0) return null;
      return Math.round((days / (mine.length - 1)) * 10) / 10;
    })();

    const tally = (vals: (string | null | undefined)[]) => {
      const m = new Map<string, number>();
      for (const v of vals) {
        const k = (v ?? "").trim();
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, count]) => ({ label, count }));
    };

    // Favourite products & categories from order items.
    let favProducts: { label: string; count: number }[] = [];
    let favCategories: { label: string; count: number }[] = [];
    if (orderIds.size) {
      const { data: items } = await context.supabase
        .from("order_items")
        .select("product_id,name_snapshot,qty")
        .in("order_id", Array.from(orderIds).slice(0, 300));
      const rows = (items ?? []) as any[];
      favProducts = tally(rows.flatMap((i) => Array(Math.max(1, Number(i.qty) || 1)).fill(i.name_snapshot)));
      const pids = Array.from(new Set(rows.map((i) => i.product_id).filter(Boolean)));
      if (pids.length) {
        const { data: prods } = await context.supabase
          .from("products")
          .select("id,category_id,categories(name)")
          .in("id", pids.slice(0, 200));
        const catByProduct = new Map(
          ((prods ?? []) as any[]).map((p) => [p.id, p.categories?.name ?? null]),
        );
        favCategories = tally(rows.map((i) => catByProduct.get(i.product_id) ?? null));
      }
    }

    const analytics = {
      spend: spendNoCancel,
      saved: stats.discount,
      favCategories,
      favProducts,
      payment: tally(mine.map((o) => o.payment_method))[0]?.label ?? null,
      courier: tally(mine.map((o) => o.courier_name))[0]?.label ?? null,
      frequencyDays: freq,
    };

    // Timeline
    const timeline: { at: string; label: string; detail?: string }[] = [];
    if (account) timeline.push({ at: account.created_at, label: "Account created" });
    mine.forEach((o, idx) => {
      timeline.push({
        at: o.created_at,
        label: idx === mine.length - 1 ? "First order placed" : "Order placed",
        detail: o.invoice_no ?? o.id.slice(0, 8),
      });
      if (o.payment_status === "paid") timeline.push({ at: o.created_at, label: "Payment received", detail: o.payment_method ?? "" });
      if (o.courier_tracking_id)
        timeline.push({ at: o.created_at, label: "Courier assigned", detail: `${o.courier_name ?? ""} ${o.courier_tracking_id}` });
      if (o.status === "delivered") timeline.push({ at: o.created_at, label: "Delivered", detail: o.invoice_no ?? "" });
    });
    for (const r of myReturns) {
      timeline.push({ at: r.created_at, label: r.type === "exchange" ? "Exchange requested" : "Return requested", detail: r.status });
      if (r.refund_processed_at) timeline.push({ at: r.refund_processed_at, label: "Refund completed" });
    }
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    return {
      key: data.key,
      summary: summaryRow ?? null,
      account: account
        ? {
            id: account.id,
            full_name: account.full_name,
            email: account.email,
            phone: account.phone,
            is_active: account.is_active,
            last_login_at: account.last_login_at,
            created_at: account.created_at,
          }
        : null,
      name: account?.full_name || mine[0]?.customer_name || "Guest",
      phone: account?.phone || mine[0]?.phone || "",
      email: account?.email || mine[0]?.email || null,
      stats,
      analytics,
      addresses,
      orderAddresses,
      orders: mine.map((o) => ({
        id: o.id,
        invoice_no: o.invoice_no,
        created_at: o.created_at,
        amount: Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0),
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        courier_name: o.courier_name,
        courier_tracking_id: o.courier_tracking_id,
        status: o.status,
        order_type: o.order_type,
      })),
      returns: myReturns.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        type: r.type,
        kind: r.request_kind,
        status: r.status,
        refund_amount: Number(r.refund_amount ?? 0),
        replacement_order_id: r.replacement_order_id,
        courier_name: r.courier_name,
        courier_tracking_id: r.courier_tracking_id,
      })),
      timeline: timeline.slice(0, 60),
      note: note ? { tags: (note as any).tags ?? [], note: (note as any).note ?? "" } : { tags: [], note: "" },
    };
  });

export const setCustomerBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/customers-admin.server");
    const storeId = await s.ownerStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("No store");
    // Blocking a customer is an owner-only decision, not for delegated staff.
    const { data: owned } = await context.supabase
      .from("stores").select("id").eq("id", storeId).eq("owner_user_id", context.userId).maybeSingle();
    if (!owned) throw new Error("শুধু store-এর মালিক customer block/unblock করতে পারবেন।");
    const { error } = await context.supabase
      .from("store_customers")
      .update({ is_active: !data.blocked })
      .eq("id", data.accountId)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
