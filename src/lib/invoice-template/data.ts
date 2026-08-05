// Invoice data model + dynamic variable resolution.
// Used by the renderer (real data) and the builder (sample data).

export type InvoiceItem = {
  name: string;
  sku?: string | null;
  variant?: string | null;
  image?: string | null;
  qty: number;
  price: number;
  total: number;
};

export type InvoiceData = {
  store: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
    website?: string | null;
    owner_name?: string | null;
    trade_license?: string | null;
    bin_vat?: string | null;
    signature?: string | null;
    seal?: string | null;
  };
  /** Global invoice information footer (store-wide, template independent). */
  footer?: {
    thanks?: string | null;
    terms?: string | null;
    refund?: string | null;
  };
  display?: {
    logo?: boolean;
    signature?: boolean;
    seal?: boolean;
    terms?: boolean;
  };
  order: {
    id: string;
    invoice_no: string;
    date: string;
    status?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    courier_name?: string | null;
    tracking_id?: string | null;
    tracking_url?: string | null;
    payment_url?: string | null;
    note?: string | null;
  };
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    area?: string | null;
  };
  items: InvoiceItem[];
  totals: {
    subtotal: number;
    delivery: number;
    discount: number;
    total: number;
    paid?: number;
    due?: number;
  };
  currency: string;
};

export const VARIABLE_GROUPS: { group: string; vars: { key: string; label: string }[] }[] = [
  {
    group: "Store",
    vars: [
      { key: "store_name", label: "Store name" },
      { key: "store_address", label: "Store address" },
      { key: "store_phone", label: "Store phone" },
      { key: "store_email", label: "Store email" },
      { key: "store_website", label: "Store website" },
      { key: "owner_name", label: "Owner name" },
      { key: "trade_license", label: "Trade license" },
      { key: "bin_vat", label: "BIN / VAT number" },
      { key: "thank_you", label: "Thank you message" },
      { key: "terms", label: "Terms & conditions" },
      { key: "refund_policy", label: "Return / refund policy" },
    ],
  },
  {
    group: "Customer",
    vars: [
      { key: "customer_name", label: "Customer name" },
      { key: "customer_phone", label: "Customer phone" },
      { key: "customer_email", label: "Customer email" },
      { key: "customer_address", label: "Customer address" },
      { key: "customer_area", label: "Customer area" },
    ],
  },
  {
    group: "Order",
    vars: [
      { key: "invoice_number", label: "Invoice number" },
      { key: "order_id", label: "Order ID" },
      { key: "order_date", label: "Order date" },
      { key: "order_status", label: "Order status" },
      { key: "payment_method", label: "Payment method" },
      { key: "payment_status", label: "Payment status" },
      { key: "courier_name", label: "Courier name" },
      { key: "tracking_id", label: "Tracking ID" },
      { key: "order_note", label: "Order note" },
      { key: "current_date", label: "Current date" },
    ],
  },
  {
    group: "Amounts",
    vars: [
      { key: "subtotal", label: "Subtotal" },
      { key: "delivery_charge", label: "Delivery charge" },
      { key: "discount", label: "Discount" },
      { key: "total", label: "Grand total" },
      { key: "paid", label: "Paid amount" },
      { key: "due", label: "Due amount" },
      { key: "currency", label: "Currency" },
    ],
  },
];

export function formatMoney(n: number, currency = "৳") {
  const v = Number(n || 0);
  return `${currency}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function variableMap(d: InvoiceData): Record<string, string> {
  const cur = d.currency || "৳";
  return {
    store_name: d.store.name ?? "",
    store_address: d.store.address ?? "",
    store_phone: d.store.phone ?? "",
    store_email: d.store.email ?? "",
    store_website: d.store.website ?? "",
    customer_name: d.customer.name ?? "",
    customer_phone: d.customer.phone ?? "",
    customer_email: d.customer.email ?? "",
    customer_address: d.customer.address ?? "",
    customer_area: d.customer.area ?? "",
    invoice_number: d.order.invoice_no ?? "",
    order_id: d.order.id ? d.order.id.slice(0, 8).toUpperCase() : "",
    order_date: d.order.date ? new Date(d.order.date).toLocaleDateString() : "",
    order_status: d.order.status ?? "",
    payment_method: d.order.payment_method ?? "",
    payment_status: d.order.payment_status ?? "",
    courier_name: d.order.courier_name ?? "",
    tracking_id: d.order.tracking_id ?? "",
    order_note: d.order.note ?? "",
    current_date: new Date().toLocaleDateString(),
    subtotal: formatMoney(d.totals.subtotal, cur),
    delivery_charge: formatMoney(d.totals.delivery, cur),
    discount: formatMoney(d.totals.discount, cur),
    total: formatMoney(d.totals.total, cur),
    paid: formatMoney(d.totals.paid ?? 0, cur),
    due: formatMoney(d.totals.due ?? 0, cur),
    currency: cur,
  };
}

/** Replace every {{variable}} in a string. Unknown tokens render as empty. */
export function applyVariables(text: string, d: InvoiceData) {
  const map = variableMap(d);
  return (text ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k: string) => map[k.toLowerCase()] ?? "");
}

export const SAMPLE_INVOICE: InvoiceData = {
  store: {
    name: "Your Store",
    address: "123 Commerce Road, Dhaka 1207",
    phone: "+880 1700-000000",
    email: "hello@yourstore.com",
    website: "yourstore.orzen.top",
    logo: null,
  },
  order: {
    id: "8f3c21ab-77aa-4a11-9f0e-2c0b1a9e51dd",
    invoice_no: "ST-000123",
    date: new Date().toISOString(),
    status: "confirmed",
    payment_method: "Cash on Delivery",
    payment_status: "pending",
    courier_name: "SteadFast",
    tracking_id: "SF9384712",
    tracking_url: "https://steadfast.com.bd/t/SF9384712",
    payment_url: null,
    note: "Please call before delivery.",
  },
  customer: {
    name: "Rahim Uddin",
    phone: "+880 1811-223344",
    email: "rahim@example.com",
    address: "House 12, Road 5, Banani, Dhaka",
    area: "Banani",
  },
  items: [
    { name: "Premium Cotton Panjabi", sku: "PNJ-001", variant: "Blue / L", image: null, qty: 1, price: 2450, total: 2450 },
    { name: "Leather Wallet", sku: "WAL-114", variant: "Brown", image: null, qty: 2, price: 890, total: 1780 },
    { name: "Analog Wrist Watch", sku: "WCH-320", variant: null, image: null, qty: 1, price: 3200, total: 3200 },
  ],
  totals: { subtotal: 7430, delivery: 120, discount: 430, total: 7120, paid: 0, due: 7120 },
  currency: "৳",
};
