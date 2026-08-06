// Server-only aggregation helpers for the store admin customer CRM.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AnyClient = SupabaseClient<any, any, any>;

export function normalizePhone(p?: string | null) {
  const d = String(p ?? "").replace(/[^0-9]/g, "");
  return d || "";
}

/** Stable merge key: normalized phone when present, else email. */
export function customerKey(phone?: string | null, email?: string | null) {
  const p = normalizePhone(phone);
  if (p) return `p:${p}`;
  const e = String(email ?? "").trim().toLowerCase();
  if (e) return `e:${e}`;
  return "";
}

export async function ownerStoreId(supabase: AnyClient, userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type OrderRow = {
  id: string;
  invoice_no: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  subtotal: number | null;
  delivery_amount: number | null;
  discount_amount: number | null;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  courier_name: string | null;
  courier_code: string | null;
  courier_tracking_id: string | null;
  order_type: string | null;
  customer_id: string | null;
  created_at: string;
};

const ORDER_COLS =
  "id,invoice_no,customer_name,phone,email,address,area,subtotal,delivery_amount,discount_amount,status,payment_method,payment_status,courier_name,courier_code,courier_tracking_id,order_type,customer_id,created_at";

const sel = (s: string): string => s;

export async function loadOrders(supabase: AnyClient, storeId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(sel(ORDER_COLS))
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<OrderRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type AccountRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export async function loadAccounts(supabase: AnyClient, storeId: string) {
  const { data } = await supabase
    .from("store_customers")
    .select(sel("id,full_name,email,phone,is_active,last_login_at,created_at"))
    .eq("store_id", storeId)
    .limit(5000)
    .returns<AccountRow[]>();
  return data ?? [];
}

export type ReturnRow = {
  id: string;
  order_id: string | null;
  type: string;
  request_kind: string | null;
  status: string;
  phone: string | null;
  refund_amount: number | null;
  replacement_order_id: string | null;
  courier_name: string | null;
  courier_tracking_id: string | null;
  created_at: string;
};

export async function loadReturns(supabase: AnyClient, storeId: string) {
  const { data } = await supabase
    .from("returns")
    .select(
      sel(
        "id,order_id,type,request_kind,status,phone,refund_amount,replacement_order_id,courier_name,courier_tracking_id,created_at",
      ),
    )
    .eq("store_id", storeId)
    .limit(5000)
    .returns<ReturnRow[]>();
  return data ?? [];
}

export type CustomerSummaryRow = {
  key: string;
  accountId: string | null;
  name: string;
  phone: string;
  email: string | null;
  orders: number;
  spend: number;
  discount: number;
  lastOrder: string | null;
  firstOrder: string | null;
  joined: string | null;
  lastLogin: string | null;
  blocked: boolean;
  hasAccount: boolean;
  pending: number;
  delivered: number;
  cancelled: number;
  returns: number;
  exchanges: number;
  tags: string[];
  status: "new" | "returning" | "vip" | "inactive" | "blocked";
};

const DAY = 86400000;

export function buildCustomers(opts: {
  orders: OrderRow[];
  accounts: AccountRow[];
  returns: ReturnRow[];
  notes: { customer_phone: string; tags: string[] | null }[];
}): CustomerSummaryRow[] {
  const map = new Map<string, CustomerSummaryRow>();
  const now = Date.now();

  const blank = (key: string): CustomerSummaryRow => ({
    key,
    accountId: null,
    name: "Guest",
    phone: "",
    email: null,
    orders: 0,
    spend: 0,
    discount: 0,
    lastOrder: null,
    firstOrder: null,
    joined: null,
    lastLogin: null,
    blocked: false,
    hasAccount: false,
    pending: 0,
    delivered: 0,
    cancelled: 0,
    returns: 0,
    exchanges: 0,
    tags: [],
    status: "new",
  });

  for (const a of opts.accounts) {
    const key = customerKey(a.phone, a.email);
    if (!key) continue;
    const c = map.get(key) ?? blank(key);
    c.accountId = a.id;
    c.hasAccount = true;
    c.name = a.full_name || c.name;
    c.phone = a.phone || c.phone;
    c.email = a.email ?? c.email;
    c.joined = a.created_at;
    c.lastLogin = a.last_login_at;
    c.blocked = !a.is_active;
    map.set(key, c);
  }

  for (const o of opts.orders) {
    const key = customerKey(o.phone, o.email);
    if (!key) continue;
    const c = map.get(key) ?? blank(key);
    if (!c.hasAccount && o.customer_name) c.name = o.customer_name;
    if (!c.phone && o.phone) c.phone = o.phone;
    if (!c.email && o.email) c.email = o.email;
    c.orders += 1;
    if (o.status !== "cancelled") {
      c.spend += Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0);
    }
    c.discount += Number(o.discount_amount ?? 0);
    if (!c.lastOrder || o.created_at > c.lastOrder) c.lastOrder = o.created_at;
    if (!c.firstOrder || o.created_at < c.firstOrder) c.firstOrder = o.created_at;
    if (o.status === "delivered") c.delivered += 1;
    else if (o.status === "cancelled") c.cancelled += 1;
    else c.pending += 1;
    map.set(key, c);
  }

  for (const r of opts.returns) {
    const key = customerKey(r.phone, null);
    const c = key ? map.get(key) : null;
    if (!c) continue;
    if (r.type === "exchange" || r.request_kind === "exchange") c.exchanges += 1;
    else c.returns += 1;
  }

  const noteMap = new Map(opts.notes.map((n) => [normalizePhone(n.customer_phone), n.tags ?? []]));

  const rows = Array.from(map.values());
  const spends = rows.map((r) => r.spend).sort((a, b) => b - a);
  const vipCut = Math.max(spends[Math.floor(spends.length * 0.1)] ?? 0, 1);

  for (const c of rows) {
    c.tags = noteMap.get(normalizePhone(c.phone)) ?? [];
    const last = c.lastOrder ? Date.parse(c.lastOrder) : c.joined ? Date.parse(c.joined) : now;
    if (c.blocked) c.status = "blocked";
    else if (c.orders >= 3 && c.spend >= vipCut) c.status = "vip";
    else if (now - last > 90 * DAY) c.status = "inactive";
    else if (c.orders >= 2) c.status = "returning";
    else c.status = "new";
  }
  return rows;
}
