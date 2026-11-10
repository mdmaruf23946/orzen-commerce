// Server-only aggregation for the Store Admin analytics dashboard.
// Everything here is scoped to a single store_id and computed from real rows.

export type PType = "physical" | "digital" | "service" | "subscription";

export type AnalyticsInput = {
  product_type?: PType | undefined;
  from: string;
  to: string;
  compare_from: string;
  compare_to: string;
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const dayOf = (v: string | Date) => new Date(v).toISOString().slice(0, 10);
const startTs = (d: string) => `${d}T00:00:00.000Z`;
const endTs = (d: string) => `${d}T23:59:59.999Z`;

function spanDays(from: string, to: string) {
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
}

export function bucketMode(from: string, to: string): "day" | "week" | "month" {
  const n = spanDays(from, to);
  if (n <= 62) return "day";
  if (n <= 400) return "week";
  return "month";
}

function bucketKey(iso: string, mode: "day" | "week" | "month") {
  const d = new Date(iso);
  if (mode === "month") return `${d.toISOString().slice(0, 7)}-01`;
  if (mode === "week") {
    const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    c.setUTCDate(c.getUTCDate() - c.getUTCDay());
    return c.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function bucketList(from: string, to: string, mode: "day" | "week" | "month") {
  const out: string[] = [];
  const cur = new Date(startTs(from));
  const end = new Date(startTs(to));
  if (mode === "month") {
    cur.setUTCDate(1);
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  } else if (mode === "week") {
    cur.setUTCDate(cur.getUTCDate() - cur.getUTCDay());
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  } else {
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return out;
}

const live = (o: any) => o.status !== "cancelled";
const typeOf = (o: any): PType => (o.order_type ?? "physical") as PType;

export async function computeAnalytics(supabase: any, sid: string, input: AnalyticsInput) {
  const { from, to, compare_from: cFrom, compare_to: cTo, product_type: type } = input;

  const orderCols =
    "id,phone,customer_name,subtotal,delivery_amount,discount_amount,paid_amount,payment_status,payment_method,status,order_type,invoice_no,created_at";

  let curOrdersQ = supabase
    .from("orders")
    .select(orderCols)
    .eq("store_id", sid)
    .gte("created_at", startTs(from))
    .lte("created_at", endTs(to));
  let prevOrdersQ = supabase
    .from("orders")
    .select("id,phone,subtotal,status,order_type,created_at")
    .eq("store_id", sid)
    .gte("created_at", startTs(cFrom))
    .lte("created_at", endTs(cTo));
  let itemsQ = supabase
    .from("order_items")
    .select("product_id,qty,price_snapshot,name_snapshot,orders!inner(store_id,status,order_type,created_at)")
    .eq("orders.store_id", sid)
    .gte("orders.created_at", startTs(from))
    .lte("orders.created_at", endTs(to));
  let priorQ = supabase
    .from("orders")
    .select("phone")
    .eq("store_id", sid)
    .lt("created_at", startTs(from))
    .neq("status", "cancelled")
    .limit(20000);

  if (type) {
    curOrdersQ = curOrdersQ.eq("order_type", type);
    prevOrdersQ = prevOrdersQ.eq("order_type", type);
    itemsQ = itemsQ.eq("orders.order_type", type);
    priorQ = priorQ.eq("order_type", type);
  }

  const [
    { data: curOrders },
    { data: prevOrders },
    { data: items },
    { data: prior },
    { data: products },
    { data: curExp },
    { data: prevExp },
    { data: subs },
    { data: downloads },
    { data: storeRow },
  ] = await Promise.all([
    curOrdersQ.limit(20000),
    prevOrdersQ.limit(20000),
    itemsQ.limit(20000),
    priorQ,
    supabase.from("products").select("id,name,primary_image_url,product_type,cost_price").eq("store_id", sid).limit(5000),
    supabase.from("expenses").select("amount,category,spent_on,note,created_at").eq("store_id", sid).gte("spent_on", from).lte("spent_on", to),
    supabase.from("expenses").select("amount").eq("store_id", sid).gte("spent_on", cFrom).lte("spent_on", cTo),
    supabase.from("store_subscriptions").select("id,status,price,billing_cycle,created_at,cancelled_at").eq("store_id", sid).limit(5000),
    supabase.from("digital_downloads").select("id,created_at,file_path").eq("store_id", sid).gte("created_at", startTs(from)).lte("created_at", endTs(to)).limit(5000),
    supabase.from("stores").select("marketing").eq("id", sid).maybeSingle(),
  ]);

  const productRows = (products ?? []) as any[];
  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  const presence = {
    physical: productRows.some((p) => (p.product_type ?? "physical") === "physical"),
    digital: productRows.some((p) => p.product_type === "digital"),
    service: productRows.some((p) => p.product_type === "service"),
    subscription: productRows.some((p) => p.product_type === "subscription"),
  };

  const cur = ((curOrders ?? []) as any[]).filter(live);
  const prev = ((prevOrders ?? []) as any[]).filter(live);

  // ---- revenue / orders / status
  const revenue = cur.reduce((a, o) => a + num(o.subtotal), 0);
  const prevRevenue = prev.reduce((a, o) => a + num(o.subtotal), 0);
  const orders = cur.length;
  const prevOrdersCount = prev.length;

  const statusCounts: Record<string, number> = {
    pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0,
  };
  for (const o of (curOrders ?? []) as any[]) {
    const s = String(o.status ?? "pending");
    if (s in statusCounts) statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  // ---- type breakdown
  const typeBreakdown: { type: PType; revenue: number; orders: number }[] = (
    ["physical", "digital", "service", "subscription"] as PType[]
  ).map((t) => {
    const rows = cur.filter((o) => typeOf(o) === t);
    return { type: t, revenue: rows.reduce((a, o) => a + num(o.subtotal), 0), orders: rows.length };
  });

  // ---- items / product performance / cogs
  const perProduct = new Map<string, { id: string; name: string; image: string | null; qty: number; revenue: number }>();
  let cogs = 0;
  const cogsByBucket = new Map<string, number>();
  const mode = bucketMode(from, to);
  for (const it of (items ?? []) as any[]) {
    if (it.orders?.status === "cancelled") continue;
    const p = it.product_id ? byProduct.get(it.product_id) : null;
    const key = it.product_id ?? `n:${it.name_snapshot}`;
    const row = perProduct.get(key) ?? {
      id: it.product_id ?? "",
      name: p?.name ?? it.name_snapshot ?? "Unnamed product",
      image: (() => {
        const raw = (p?.primary_image_url as string | null | undefined) ?? null;
        if (!raw) return null;
        return raw.startsWith("http") || raw.startsWith("/") ? raw : `/api/img/${raw}`;
      })(),
      qty: 0,
      revenue: 0,
    };
    row.qty += num(it.qty);
    row.revenue += num(it.qty) * num(it.price_snapshot);
    perProduct.set(key, row);
    const c = num(p?.cost_price) * num(it.qty);
    cogs += c;
    if (it.orders?.created_at) {
      const b = bucketKey(it.orders.created_at, mode);
      cogsByBucket.set(b, (cogsByBucket.get(b) ?? 0) + c);
    }
  }
  const rankedAll = Array.from(perProduct.values()).sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
  const productRevenue = rankedAll.reduce((a, p) => a + p.revenue, 0) || 1;
  const withShare = (r: typeof rankedAll) => r.map((p) => ({ ...p, share: (p.revenue / productRevenue) * 100 }));
  const topProducts = withShare(rankedAll.slice(0, 5));
  const lowProducts = withShare(rankedAll.slice(-5).reverse()).filter((p) => !topProducts.some((t) => t.name === p.name));

  // ---- expenses
  const expenseRows = (curExp ?? []) as any[];
  const expenses = expenseRows.reduce((a, e) => a + num(e.amount), 0);
  const prevExpenses = ((prevExp ?? []) as any[]).reduce((a, e) => a + num(e.amount), 0);
  const expenseByBucket = new Map<string, number>();
  for (const e of expenseRows) {
    const b = bucketKey(startTs(String(e.spent_on)), mode);
    expenseByBucket.set(b, (expenseByBucket.get(b) ?? 0) + num(e.amount));
  }

  // ---- series
  const buckets = bucketList(from, to, mode);
  const seriesMap = new Map(
    buckets.map((b) => [b, { bucket: b, revenue: 0, orders: 0, expenses: expenseByBucket.get(b) ?? 0, cogs: cogsByBucket.get(b) ?? 0, profit: 0, newCustomers: 0, returningCustomers: 0 }]),
  );
  const priorPhones = new Set(((prior ?? []) as any[]).map((o) => String(o.phone ?? "")));
  const seenInRange = new Set<string>();
  for (const o of cur) {
    const b = bucketKey(o.created_at, mode);
    const row = seriesMap.get(b);
    if (row) {
      row.revenue += num(o.subtotal);
      row.orders += 1;
      const phone = String(o.phone ?? "");
      if (priorPhones.has(phone) || seenInRange.has(phone)) row.returningCustomers += 1;
      else row.newCustomers += 1;
    }
    seenInRange.add(String(o.phone ?? ""));
  }
  const series = buckets.map((b) => {
    const r = seriesMap.get(b)!;
    return { ...r, profit: r.revenue - r.cogs - r.expenses };
  });

  // ---- customers
  const phoneStats = new Map<string, { orders: number; value: number; returning: boolean }>();
  for (const o of cur) {
    const phone = String(o.phone ?? "");
    const s = phoneStats.get(phone) ?? { orders: 0, value: 0, returning: priorPhones.has(phone) };
    s.orders += 1;
    s.value += num(o.subtotal);
    phoneStats.set(phone, s);
  }
  const totalCustomers = phoneStats.size;
  const returningCustomers = Array.from(phoneStats.values()).filter((s) => s.returning || s.orders > 1).length;
  const newCustomers = totalCustomers - returningCustomers;
  const prevPhones = new Set(prev.map((o) => String(o.phone ?? "")));
  const prevNew = prevPhones.size;

  // ---- profit
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  const margin = revenue ? (netProfit / revenue) * 100 : 0;
  const prevNetProfit = prevRevenue - prevExpenses;

  // ---- type-specific
  const subRows = (subs ?? []) as any[];
  const inRange = (v: any) => v && dayOf(v) >= from && dayOf(v) <= to;
  const cycleMonths: Record<string, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12, weekly: 0.25 };
  const subscription = presence.subscription || subRows.length
    ? {
        active: subRows.filter((s) => s.status === "active").length,
        created: subRows.filter((s) => inRange(s.created_at)).length,
        cancelled: subRows.filter((s) => inRange(s.cancelled_at)).length,
        mrr: subRows
          .filter((s) => s.status === "active")
          .reduce((a, s) => a + num(s.price) / (cycleMonths[String(s.billing_cycle)] ?? 1), 0),
        revenue: typeBreakdown.find((t) => t.type === "subscription")?.revenue ?? 0,
        renewalRate: subRows.length
          ? (subRows.filter((s) => s.status === "active").length / subRows.length) * 100
          : 0,
      }
    : null;

  const serviceOrders = ((curOrders ?? []) as any[]).filter((o) => typeOf(o) === "service");
  const service = presence.service || serviceOrders.length
    ? {
        total: serviceOrders.length,
        completed: serviceOrders.filter((o) => o.status === "delivered").length,
        pending: serviceOrders.filter((o) => ["pending", "confirmed", "processing"].includes(String(o.status))).length,
        cancelled: serviceOrders.filter((o) => o.status === "cancelled").length,
        revenue: typeBreakdown.find((t) => t.type === "service")?.revenue ?? 0,
      }
    : null;

  const digitalOrders = ((curOrders ?? []) as any[]).filter((o) => typeOf(o) === "digital" && live(o));
  const dlRows = (downloads ?? []) as any[];
  const dlCounter = new Map<string, number>();
  for (const d of dlRows) {
    const k = String(d.file_path ?? "").split("/").pop() ?? "File";
    dlCounter.set(k, (dlCounter.get(k) ?? 0) + 1);
  }
  const digital = presence.digital || digitalOrders.length
    ? {
        orders: digitalOrders.length,
        downloads: dlRows.length,
        revenue: typeBreakdown.find((t) => t.type === "digital")?.revenue ?? 0,
        top: Array.from(dlCounter.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      }
    : null;

  // ---- funnel (only what the database actually records)
  const paidOrders = ((curOrders ?? []) as any[]).filter(
    (o) => String(o.payment_status ?? "").toLowerCase() === "paid" || o.status === "delivered" || o.status === "confirmed",
  ).length;
  const funnel = {
    checkoutStarted: (curOrders ?? []).length,
    purchases: orders,
    fulfilled: paidOrders,
  };

  // ---- marketing config presence
  const m = (storeRow as any)?.marketing ?? {};
  const marketing = {
    facebook: Boolean(m?.fb_pixel_id || m?.facebook?.fb_pixel_id || m?.fb_pixel_enabled),
    google: Boolean(m?.google?.ga4_id || m?.google?.ads_conversion_id || m?.google?.gtm_id),
    tiktok: Boolean(m?.tiktok?.pixel_id),
  };

  // ---- recent activity
  const activity = [
    ...((curOrders ?? []) as any[]).map((o) => ({
      kind: o.status === "delivered" ? "delivered" : o.status === "cancelled" ? "cancelled" : "order",
      title:
        o.status === "delivered"
          ? `Order ${o.invoice_no ?? ""} delivered`
          : o.status === "cancelled"
            ? `Order ${o.invoice_no ?? ""} cancelled`
            : `New order from ${o.customer_name ?? "customer"}`,
      amount: num(o.subtotal),
      at: o.created_at as string,
    })),
    ...expenseRows.map((e) => ({
      kind: "expense" as const,
      title: `Expense recorded${e.note ? ` — ${e.note}` : ""}`,
      amount: -num(e.amount),
      at: (e.created_at ?? startTs(String(e.spent_on))) as string,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12);

  // ---- insights (real data only)
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);
  const insights: string[] = [];
  if (prevRevenue > 0 && revenue > 0) {
    const c = pct(revenue, prevRevenue);
    insights.push(
      `Sales are ${c >= 0 ? "up" : "down"} ${Math.abs(c).toFixed(1)}% compared with the previous period.`,
    );
  }
  if (topProducts[0]) {
    insights.push(`${topProducts[0].name} generated the highest revenue in this period.`);
  }
  if (totalCustomers > 0 && returningCustomers > 0) {
    insights.push(
      `Returning customers made up ${((returningCustomers / totalCustomers) * 100).toFixed(0)}% of buyers in this period.`,
    );
  }
  if (expenses > 0 && prevExpenses > 0) {
    const c = pct(expenses, prevExpenses);
    insights.push(`Expenses ${c >= 0 ? "increased" : "decreased"} by ${Math.abs(c).toFixed(1)}% versus the previous period.`);
  }
  if (revenue > 0) {
    insights.push(`Your net profit margin for this period is ${margin.toFixed(1)}%.`);
  }

  return {
    range: { from, to, mode },
    compare: { from: cFrom, to: cTo },
    kpis: {
      revenue, prevRevenue,
      orders, prevOrders: prevOrdersCount,
      aov: orders ? revenue / orders : 0,
      prevAov: prevOrdersCount ? prevRevenue / prevOrdersCount : 0,
      netProfit, prevNetProfit,
      expenses, prevExpenses,
      margin, prevMargin: prevRevenue ? (prevNetProfit / prevRevenue) * 100 : 0,
      newCustomers, prevNewCustomers: prevNew,
      returningCustomers, prevReturningCustomers: 0,
    },
    series,
    statusCounts,
    typeBreakdown,
    products: { top: topProducts, low: lowProducts },
    customers: {
      total: totalCustomers,
      new: newCustomers,
      returning: returningCustomers,
      rate: totalCustomers ? (returningCustomers / totalCustomers) * 100 : 0,
      avgValue: totalCustomers ? revenue / totalCustomers : 0,
      avgOrders: totalCustomers ? orders / totalCustomers : 0,
    },
    finance: { grossRevenue: revenue, cogs, expenses, grossProfit, netProfit, margin },
    presence,
    subscription,
    service,
    digital,
    funnel,
    marketing,
    activity,
    insights,
  };
}

export type AnalyticsPayload = Awaited<ReturnType<typeof computeAnalytics>>;
