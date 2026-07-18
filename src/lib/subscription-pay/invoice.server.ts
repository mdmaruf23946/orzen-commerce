// Server-only invoice rendering. Generates a self-contained HTML
// invoice and stores it in the private `subscription-invoices`
// bucket. Users download via a short-lived signed URL. HTML is
// print-to-PDF friendly and works inside a Cloudflare Worker without
// heavy PDF libraries.

type InvoiceData = {
  invoice_no: string;
  issued_at: string;
  customer_name: string;
  customer_email: string;
  store_name: string | null;
  package_name: string;
  billing_cycle: string;
  amount: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  coupon_code?: string | null;
  provider_label?: string;
  method?: string | null;
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  "3m": "3 Months",
  "6m": "6 Months",
  yearly: "Yearly",
};

function html(inv: InvoiceData) {
  const money = (n: number) => `${inv.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${inv.invoice_no}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;padding:40px;background:#fff}
  .card{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px}
  h1{margin:0;font-size:22px}
  .muted{color:#6b7280;font-size:13px}
  .row{display:flex;justify-content:space-between;margin:6px 0}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;font-size:14px}
  th{background:#f9fafb;font-weight:600}
  .total{font-size:18px;font-weight:700}
  .brand{color:#3b82f6;font-weight:700}
  @media print{.no-print{display:none}}
</style></head>
<body>
<div class="card">
  <div class="row"><div><div class="brand">ORZEN</div><div class="muted">Subscription invoice</div></div>
    <div style="text-align:right"><div><b>${inv.invoice_no}</b></div><div class="muted">${new Date(inv.issued_at).toLocaleDateString()}</div></div>
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
  <div class="row"><div><div class="muted">Billed to</div><div><b>${inv.customer_name}</b></div><div>${inv.customer_email}</div>${inv.store_name ? `<div class="muted">${inv.store_name}</div>` : ""}</div>
    <div style="text-align:right"><div class="muted">Provider</div><div>${inv.provider_label ?? "—"}</div>${inv.method ? `<div class="muted">${inv.method}</div>` : ""}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Cycle</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>${inv.package_name}</td><td>${CYCLE_LABELS[inv.billing_cycle] ?? inv.billing_cycle}</td><td style="text-align:right">${money(inv.amount)}</td></tr>
      ${inv.discount > 0 ? `<tr><td colspan="2">Discount${inv.coupon_code ? ` (${inv.coupon_code})` : ""}</td><td style="text-align:right">−${money(inv.discount)}</td></tr>` : ""}
      ${inv.tax > 0 ? `<tr><td colspan="2">Tax</td><td style="text-align:right">${money(inv.tax)}</td></tr>` : ""}
      <tr><td colspan="2" class="total">Total</td><td style="text-align:right" class="total">${money(inv.total)}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:24px">Thank you for using ORZEN. This invoice was generated automatically after successful payment verification.</p>
  <button class="no-print" onclick="window.print()" style="margin-top:12px;padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer">Print / Save PDF</button>
</div>
</body></html>`;
}

export async function generateAndStoreInvoice(inv: InvoiceData): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const body = html(inv);
  const path = `${inv.invoice_no}.html`;
  const { error } = await supabaseAdmin.storage
    .from("subscription-invoices")
    .upload(path, new Blob([body], { type: "text/html" }), {
      contentType: "text/html",
      upsert: true,
    });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedInvoiceUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("subscription-invoices")
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
