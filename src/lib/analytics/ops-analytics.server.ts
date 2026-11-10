// Server-only aggregation for the Courier Overview and Payment Gateway
// Overview mini dashboards in the Store Admin analytics page.
//
// Read-only reporting: it never mutates orders, parcels or payments.
import { normalizeStatus, type ParcelStatus } from "@/lib/couriers/status";

type AnyClient = any;

export type OpsRangeInput = {
  from: string;
  to: string;
  compare_from: string;
  compare_to: string;
};

const startTs = (d: string) => `${d}T00:00:00.000Z`;
const endTs = (d: string) => `${d}T23:59:59.999Z`;
const day = (iso: string) => iso.slice(0, 10);
const num = (v: unknown) => Number(v ?? 0) || 0;
const rate = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

/* ------------------------------------------------------------------ */
/* Courier overview                                                    */
/* ------------------------------------------------------------------ */

export type CourierBucketKey = "pending" | "in_transit" | "delivered" | "returned" | "cancelled";

export type CourierRow = {
  key: string;
  label: string;
  total: number;
  pending: number;
  in_transit: number;
  delivered: number;
  returned: number;
  cancelled: number;
  cod: number;
  codCollected: number;
  avgDays: number;
  successRate: number;
  returnRate: number;
};

export type CourierOverview = {
  rows: CourierRow[];
  totals: {
    total: number;
    delivered: number;
    returned: number;
    cancelled: number;
    inTransit: number;
    pending: number;
    cod: number;
    codCollected: number;
    successRate: number;
    returnRate: number;
  };
  previous: { total: number; delivered: number; returned: number; cod: number; successRate: number };
  series: { bucket: string; [courier: string]: number | string }[];
  couriers: { key: string; label: string }[];
};

function courierBucket(status: ParcelStatus): CourierBucketKey {
  switch (status) {
    case "delivered":
    case "partial_delivered":
      return "delivered";
    case "returned":
      return "returned";
    case "cancelled":
    case "failed":
      return "cancelled";
    case "in_transit":
    case "pickup_completed":
      return "in_transit";
    default:
      return "pending";
  }
}

const COURIER_LABELS: Record<string, string> = {
  steadfast: "SteadFast",
  pathao: "Pathao",
  redx: "RedX",
  paperfly: "Paperfly",
  ecourier: "eCourier",
  sa_paribahan: "SA Paribahan",
  sundarban: "Sundarban",
};

const titleCase = (s: string) =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

type ShipmentFact = {
  courier: string;
  label: string;
  status: ParcelStatus;
  cod: number;
  collected: boolean;
  createdAt: string;
  settledAt: string | null;
};

async function loadShipments(supabase: AnyClient, storeId: string, from: string, to: string): Promise<ShipmentFact[]> {
  const out: ShipmentFact[] = [];
  const seenOrders = new Set<string>();

  const { data: parcels } = await supabase
    .from("courier_parcels")
    .select("order_id,courier_key,status,cod_amount,collection_status,created_at,updated_at")
    .eq("store_id", storeId)
    .gte("created_at", startTs(from))
    .lte("created_at", endTs(to))
    .limit(5000);

  for (const p of (parcels ?? []) as any[]) {
    const courier = String(p.courier_key ?? "").trim() || "unknown";
    if (p.order_id) seenOrders.add(String(p.order_id));
    const status = normalizeStatus(p.status);
    out.push({
      courier,
      label: COURIER_LABELS[courier] ?? titleCase(courier),
      status,
      cod: num(p.cod_amount),
      collected: p.collection_status === "collected" || p.collection_status === "paid",
      createdAt: String(p.created_at),
      settledAt: status === "delivered" || status === "returned" ? (p.updated_at ?? null) : null,
    });
  }

  // Orders shipped without a parcel record (manual couriers / legacy rows).
  const { data: orders } = await supabase
    .from("orders")
    .select("id,courier_code,courier_name,courier_status,status,subtotal,delivery_amount,discount_amount,payment_method,created_at,updated_at")
    .eq("store_id", storeId)
    .gte("created_at", startTs(from))
    .lte("created_at", endTs(to))
    .limit(5000);

  for (const o of (orders ?? []) as any[]) {
    const code = String(o.courier_code ?? "").trim();
    const name = String(o.courier_name ?? "").trim();
    if (!code && !name) continue;
    if (seenOrders.has(String(o.id))) continue;
    const courier = code || name.toLowerCase().replace(/\s+/g, "_");
    const status = normalizeStatus(o.courier_status ?? o.status);
    const total = num(o.subtotal) + num(o.delivery_amount) - num(o.discount_amount);
    const isCod = String(o.payment_method ?? "") === "cod";
    out.push({
      courier,
      label: COURIER_LABELS[courier] ?? (name || titleCase(courier)),
      status,
      cod: isCod ? total : 0,
      collected: isCod && status === "delivered",
      createdAt: String(o.created_at),
      settledAt: status === "delivered" || status === "returned" ? (o.updated_at ?? null) : null,
    });
  }

  return out;
}

export async function computeCourierOverview(
  supabase: AnyClient,
  storeId: string,
  input: OpsRangeInput,
): Promise<CourierOverview> {
  const [current, prior] = await Promise.all([
    loadShipments(supabase, storeId, input.from, input.to),
    loadShipments(supabase, storeId, input.compare_from, input.compare_to),
  ]);

  const map = new Map<string, CourierRow & { _days: number; _dayCount: number }>();
  const seriesMap = new Map<string, Record<string, { d: number; t: number }>>();

  for (const s of current) {
    const row =
      map.get(s.courier) ??
      ({
        key: s.courier,
        label: s.label,
        total: 0,
        pending: 0,
        in_transit: 0,
        delivered: 0,
        returned: 0,
        cancelled: 0,
        cod: 0,
        codCollected: 0,
        avgDays: 0,
        successRate: 0,
        returnRate: 0,
        _days: 0,
        _dayCount: 0,
      } as CourierRow & { _days: number; _dayCount: number });

    const bucket = courierBucket(s.status);
    row.total += 1;
    row[bucket] += 1;
    row.cod += s.cod;
    if (s.collected) row.codCollected += s.cod;
    if (s.settledAt) {
      const days = (Date.parse(s.settledAt) - Date.parse(s.createdAt)) / 86400000;
      if (Number.isFinite(days) && days >= 0 && days < 90) {
        row._days += days;
        row._dayCount += 1;
      }
    }
    map.set(s.courier, row);

    const b = day(s.createdAt);
    const byDay = seriesMap.get(b) ?? {};
    const cell = byDay[s.courier] ?? { d: 0, t: 0 };
    cell.t += 1;
    if (bucket === "delivered") cell.d += 1;
    byDay[s.courier] = cell;
    seriesMap.set(b, byDay);
  }

  const rows: CourierRow[] = Array.from(map.values())
    .map((r) => {
      const { _days, _dayCount, ...rest } = r;
      return {
        ...rest,
        avgDays: _dayCount > 0 ? Math.round((_days / _dayCount) * 10) / 10 : 0,
        successRate: rate(r.delivered, r.total),
        returnRate: rate(r.returned, r.total),
      };
    })
    .sort((a, b) => b.total - a.total);

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.delivered += r.delivered;
      acc.returned += r.returned;
      acc.cancelled += r.cancelled;
      acc.inTransit += r.in_transit;
      acc.pending += r.pending;
      acc.cod += r.cod;
      acc.codCollected += r.codCollected;
      return acc;
    },
    {
      total: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
      inTransit: 0,
      pending: 0,
      cod: 0,
      codCollected: 0,
      successRate: 0,
      returnRate: 0,
    },
  );
  totals.successRate = rate(totals.delivered, totals.total);
  totals.returnRate = rate(totals.returned, totals.total);

  const prev = prior.reduce(
    (acc, s) => {
      const bucket = courierBucket(s.status);
      acc.total += 1;
      if (bucket === "delivered") acc.delivered += 1;
      if (bucket === "returned") acc.returned += 1;
      acc.cod += s.cod;
      return acc;
    },
    { total: 0, delivered: 0, returned: 0, cod: 0, successRate: 0 },
  );
  prev.successRate = rate(prev.delivered, prev.total);

  const couriers = rows.map((r) => ({ key: r.key, label: r.label }));
  const series = Array.from(seriesMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([bucket, byCourier]) => {
      const point: { bucket: string; [k: string]: number | string } = { bucket };
      for (const c of couriers) {
        const cell = byCourier[c.key];
        point[c.key] = cell && cell.t > 0 ? Math.round(rate(cell.d, cell.t)) : 0;
      }
      return point;
    });

  return { rows, totals, previous: prev, series, couriers };
}

/* ------------------------------------------------------------------ */
/* Payment gateway overview                                            */
/* ------------------------------------------------------------------ */

export type PaymentRow = {
  key: string;
  label: string;
  txn: number;
  success: number;
  failed: number;
  pending: number;
  refunded: number;
  amount: number;
  refundedAmount: number;
  avgValue: number;
  successRate: number;
  share: number;
};

export type PaymentOverview = {
  rows: PaymentRow[];
  totals: {
    txn: number;
    success: number;
    failed: number;
    pending: number;
    refunded: number;
    amount: number;
    refundedAmount: number;
    successRate: number;
  };
  previous: { txn: number; success: number; amount: number; successRate: number };
  series: { bucket: string; [gateway: string]: number | string }[];
  gateways: { key: string; label: string }[];
};

type PayBucket = "success" | "failed" | "pending" | "refunded";

function payBucket(paymentStatus: unknown, orderStatus: unknown): PayBucket {
  const p = String(paymentStatus ?? "").toLowerCase();
  const o = String(orderStatus ?? "").toLowerCase();
  if (/refund/.test(p) || /refund/.test(o)) return "refunded";
  if (/paid|success|complete|captur|settled/.test(p)) return "success";
  if (/fail|declin|error|void|expire/.test(p) || o === "cancelled") return "failed";
  if (o === "delivered" && p === "unpaid") return "success"; // COD collected on delivery
  return "pending";
}

const GATEWAY_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  online: "Online Payment",
  manual: "Manual / Bank",
  sslcommerz: "SSLCommerz",
  shurjopay: "ShurjoPay",
  amarpay: "AmarPay",
  stripe: "Stripe",
  paypal: "PayPal",
};

type PayFact = {
  key: string;
  label: string;
  bucket: PayBucket;
  amount: number;
  createdAt: string;
};

async function loadPayFacts(supabase: AnyClient, storeId: string, from: string, to: string): Promise<PayFact[]> {
  const { data } = await supabase
    .from("orders")
    .select(
      "payment_gateway_name,payment_method,payment_status,status,subtotal,delivery_amount,discount_amount,paid_amount,created_at",
    )
    .eq("store_id", storeId)
    .gte("created_at", startTs(from))
    .lte("created_at", endTs(to))
    .limit(5000);

  return ((data ?? []) as any[]).map((o) => {
    const gatewayName = String(o.payment_gateway_name ?? "").trim();
    const method = String(o.payment_method ?? "").trim();
    const key = (gatewayName || method || "unknown").toLowerCase().replace(/\s+/g, "_");
    const label = GATEWAY_LABELS[key] ?? (gatewayName || titleCase(key));
    const gross = num(o.subtotal) + num(o.delivery_amount) - num(o.discount_amount);
    const bucket = payBucket(o.payment_status, o.status);
    const paid = num(o.paid_amount);
    return {
      key,
      label,
      bucket,
      amount: bucket === "success" ? (paid > 0 ? paid : gross) : gross,
      createdAt: String(o.created_at),
    };
  });
}

export async function computePaymentOverview(
  supabase: AnyClient,
  storeId: string,
  input: OpsRangeInput,
): Promise<PaymentOverview> {
  const [current, prior] = await Promise.all([
    loadPayFacts(supabase, storeId, input.from, input.to),
    loadPayFacts(supabase, storeId, input.compare_from, input.compare_to),
  ]);

  const map = new Map<string, PaymentRow>();
  const seriesMap = new Map<string, Record<string, number>>();

  for (const f of current) {
    const row =
      map.get(f.key) ??
      ({
        key: f.key,
        label: f.label,
        txn: 0,
        success: 0,
        failed: 0,
        pending: 0,
        refunded: 0,
        amount: 0,
        refundedAmount: 0,
        avgValue: 0,
        successRate: 0,
        share: 0,
      } as PaymentRow);
    row.txn += 1;
    row[f.bucket] += 1;
    if (f.bucket === "success") row.amount += f.amount;
    if (f.bucket === "refunded") row.refundedAmount += f.amount;
    map.set(f.key, row);

    if (f.bucket === "success") {
      const b = day(f.createdAt);
      const byDay = seriesMap.get(b) ?? {};
      byDay[f.key] = (byDay[f.key] ?? 0) + f.amount;
      seriesMap.set(b, byDay);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.amount - a.amount || b.txn - a.txn);
  const grossAmount = rows.reduce((s, r) => s + r.amount, 0);

  for (const r of rows) {
    r.avgValue = r.success > 0 ? r.amount / r.success : 0;
    r.successRate = rate(r.success, r.txn);
    r.share = rate(r.amount, grossAmount);
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.txn += r.txn;
      acc.success += r.success;
      acc.failed += r.failed;
      acc.pending += r.pending;
      acc.refunded += r.refunded;
      acc.amount += r.amount;
      acc.refundedAmount += r.refundedAmount;
      return acc;
    },
    { txn: 0, success: 0, failed: 0, pending: 0, refunded: 0, amount: 0, refundedAmount: 0, successRate: 0 },
  );
  totals.successRate = rate(totals.success, totals.txn);

  const prev = prior.reduce(
    (acc, f) => {
      acc.txn += 1;
      if (f.bucket === "success") {
        acc.success += 1;
        acc.amount += f.amount;
      }
      return acc;
    },
    { txn: 0, success: 0, amount: 0, successRate: 0 },
  );
  prev.successRate = rate(prev.success, prev.txn);

  const gateways = rows.map((r) => ({ key: r.key, label: r.label }));
  const series = Array.from(seriesMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([bucket, byGateway]) => {
      const point: { bucket: string; [k: string]: number | string } = { bucket };
      for (const g of gateways) point[g.key] = Math.round(byGateway[g.key] ?? 0);
      return point;
    });

  return { rows, totals, previous: prev, series, gateways };
}
