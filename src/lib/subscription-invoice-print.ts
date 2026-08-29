// Standalone, print-perfect subscription invoice. Opens in its own window so
// the billing page chrome never leaks into the PDF. Client-only (uses
// window + dynamic `qrcode` import).

const esc = (v: any) =>
  String(v ?? "—").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

// The invoice renders inside a blank popup window (about:blank), so relative
// paths never resolve there — every asset URL must be absolutised.
const imgUrl = (u?: string | null) => {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  const origin = window.location.origin;
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/api/img/${u}`;
};

const fmtDate = (d: any) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()
    : null;

// Official-style gateway wordmarks (inline SVG, so printing never depends on
// a network fetch). Falls back to a branded text pill for unknown methods.
const GATEWAY: Record<string, { label: string; color: string; bg: string }> = {
  bkash: { label: "bKash", color: "#E2136E", bg: "#FDE7F0" },
  nagad: { label: "Nagad", color: "#EE1C25", bg: "#FDE8E9" },
  rocket: { label: "Rocket", color: "#8C3494", bg: "#F5E8F7" },
  upay: { label: "Upay", color: "#F58220", bg: "#FEF0E3" },
  sslcommerz: { label: "SSLCommerz", color: "#0B5FFF", bg: "#E8F0FF" },
  stripe: { label: "Stripe", color: "#635BFF", bg: "#EEEDFF" },
  wallet: { label: "ORZEN Wallet", color: "#0F766E", bg: "#E3F5F2" },
  manual: { label: "Manual Transfer", color: "#334155", bg: "#EEF2F7" },
};

function gatewayMark(method?: string | null) {
  const key = String(method ?? "").toLowerCase();
  const g = GATEWAY[key] ?? {
    label: method ? String(method).toUpperCase() : "—",
    color: "#334155",
    bg: "#EEF2F7",
  };
  return `<span class="gw" style="background:${g.bg};color:${g.color}">
    <span class="gw-dot" style="background:${g.color}"></span>${esc(g.label)}
  </span>`;
}

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBn = (s: string) => s.replace(/\d/g, (d) => bnDigits[Number(d)]);

export type InvoicePayment = {
  invoice_no?: string | null;
  created_at: string;
  amount: number | string;
  method?: string | null;
  txn_id?: string | null;
  status?: string | null;
  cycle_start?: string | null;
  cycle_end?: string | null;
  billing_cycle?: string | null;
  subscription_packages?: { name?: string | null; description?: string | null } | null;
};

export type InvoiceStore = {
  name?: string | null;
  slug?: string | null;
  icon_url?: string | null;
  logo_url?: string | null;
  name_logo_url?: string | null;
};

export type InvoiceBrand = {
  logoUrl?: string | null;
  wordmarkUrl?: string | null;
  supportEmail?: string | null;
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  "3m": "Quarterly (3 Months)",
  "6m": "Half-Yearly (6 Months)",
  yearly: "Yearly",
};

export async function openSubscriptionInvoice(
  p: InvoicePayment,
  store: InvoiceStore | null | undefined,
  brand: InvoiceBrand = {},
) {
  const win = window.open("", "_blank", "width=860,height=1000");
  if (!win) return;

  const invoiceNo = p.invoice_no ?? "—";
  const verifyUrl = `${window.location.origin}/verify/invoice/${encodeURIComponent(invoiceNo)}`;
  let qr = "";
  try {
    const m = await import("qrcode");
    qr = await m.default.toDataURL(verifyUrl, { margin: 0, width: 220 });
  } catch {
    qr = "";
  }

  const amount = Number(p.amount ?? 0);
  const amountBn = `৳${toBn(amount.toLocaleString("en-US"))}`;
  // Icon slot uses the store's icon logo; the name slot uses the name logo.
  const storeIcon = imgUrl(store?.icon_url ?? store?.logo_url ?? null);
  const storeNameLogo = imgUrl(store?.name_logo_url ?? null);
  const platformLogo = imgUrl(brand.logoUrl ?? null);
  const platformWordmark = imgUrl(brand.wordmarkUrl ?? null);
  const supportEmail = brand.supportEmail || "support@orzen.top";
  const paid = String(p.status ?? "").toLowerCase() === "paid";
  const period =
    fmtDate(p.cycle_start) && fmtDate(p.cycle_end)
      ? `${fmtDate(p.cycle_start)} – ${fmtDate(p.cycle_end)}`
      : (fmtDate(p.cycle_start) ?? fmtDate(p.created_at) ?? "—");
  const cycle = CYCLE_LABEL[String(p.billing_cycle ?? "monthly")] ?? String(p.billing_cycle ?? "Monthly");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>${esc(invoiceNo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Great+Vibes&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box}
  body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A;margin:0;padding:24px;background:#F1F5F9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:760px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:22px;border-bottom:1px solid #E2E8F0}
  .brand{display:flex;align-items:center;gap:10px}
  .brand img{height:34px;width:auto;object-fit:contain}
  .brand-fallback{display:flex;align-items:center;gap:9px}
  .brand-tile{width:34px;height:34px;border-radius:10px;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
  .brand-text{font-size:21px;font-weight:800;letter-spacing:-.02em}
  .sub{font-size:11px;color:#64748B;letter-spacing:.12em;text-transform:uppercase;margin-top:4px}
  .right{text-align:right}
  .badge{display:inline-flex;align-items:center;gap:6px;background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:.08em}
  .badge.unpaid{background:#FEF3C7;color:#B45309;border-color:#FCD34D}
  .inv-no{margin-top:10px;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
  .muted{color:#64748B;font-size:12px}
  .label{font-size:10px;font-weight:700;letter-spacing:.14em;color:#94A3B8;text-transform:uppercase;margin-bottom:8px}
  .grid{display:flex;gap:16px;margin-top:26px}
  .grid>div{flex:1}
  .box{border:1px solid #E2E8F0;border-radius:12px;padding:14px;background:#F8FAFC}
  .merchant{display:flex;align-items:center;gap:12px}
  .merchant img{height:40px;width:40px;border-radius:10px;object-fit:contain;background:#fff;border:1px solid #E2E8F0;padding:4px}
  .merchant .m-tile{height:40px;width:40px;border-radius:10px;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
  .m-name{font-size:15px;font-weight:700}
  .plan-name{font-size:15px;font-weight:700}
  .gw{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700}
  .gw-dot{width:8px;height:8px;border-radius:999px;display:inline-block}
  table{width:100%;border-collapse:collapse;margin-top:26px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}
  th{background:#F8FAFC;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64748B;text-align:left;padding:12px 14px;border-bottom:1px solid #E2E8F0}
  td{padding:14px;font-size:13.5px;border-bottom:1px solid #F1F5F9}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  tr.total td{border-bottom:none;background:#F8FAFC;font-weight:800;font-size:15px;padding:16px 14px}
  tr.total td:last-child{font-size:20px;color:#0F172A}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:30px;padding-top:20px;border-top:1px solid #E2E8F0}
  .sig{font-family:'Great Vibes',cursive;font-size:30px;line-height:1;color:#0F172A;margin-bottom:4px}
  .sig-line{border-top:1px solid #CBD5E1;width:170px;padding-top:5px;font-size:10px;letter-spacing:.12em;color:#94A3B8;text-transform:uppercase}
  .tag{display:inline-block;margin-top:10px;background:#F1F5F9;border:1px solid #E2E8F0;color:#64748B;border-radius:6px;padding:3px 8px;font-size:9.5px;letter-spacing:.12em;font-weight:700}
  .qr{text-align:center}
  .qr img{width:88px;height:88px;border:1px solid #E2E8F0;border-radius:8px;padding:5px;background:#fff}
  .qr div{font-size:9px;color:#94A3B8;letter-spacing:.1em;margin-top:6px;text-transform:uppercase}
  .actions{max-width:760px;margin:16px auto 0;text-align:center}
  button{padding:10px 18px;border:1px solid #CBD5E1;border-radius:10px;background:#0F172A;color:#fff;font-weight:600;cursor:pointer}
  @page{size:A4;margin:12mm}
  @media print{body{background:#fff;padding:0}.sheet{border:none;border-radius:0;padding:0;max-width:none}.no-print{display:none}}
</style></head><body>
<div class="sheet">
  <div class="top">
    <div>
      <div class="brand">
        ${
          platformLogo || platformWordmark
            ? `${platformLogo ? `<img src="${esc(platformLogo)}" alt="ORZEN"/>` : ""}${platformWordmark ? `<img src="${esc(platformWordmark)}" alt="ORZEN"/>` : ""}`
            : `<span class="brand-fallback"><span class="brand-tile">O</span><span class="brand-text">ORZEN</span></span>`
        }
      </div>
      <div class="sub">Subscription Invoice</div>
    </div>
    <div class="right">
      <span class="badge ${paid ? "" : "unpaid"}">${paid ? "✔ PAID" : esc(String(p.status ?? "PENDING").toUpperCase())}</span>
      <div class="inv-no">${esc(invoiceNo)}</div>
      <div class="muted">${esc(fmtDate(p.created_at))}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Billed To</div>
      <div class="box merchant">
        ${
          storeLogo
            ? `<img src="${esc(storeLogo)}" alt=""/>`
            : `<span class="m-tile">${esc((store?.name ?? "S").slice(0, 1).toUpperCase())}</span>`
        }
        <div>
          <div class="m-name">${esc(store?.name)}</div>
          ${store?.slug ? `<div class="muted">${esc(store.slug)}.orzen.top</div>` : ""}
        </div>
      </div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Plan Details</div>
      <div class="box">
        <div class="plan-name">${esc(p.subscription_packages?.name)}</div>
        ${p.subscription_packages?.description ? `<div class="muted" style="margin-top:3px">${esc(p.subscription_packages.description)}</div>` : ""}
        <div class="muted" style="margin-top:8px;font-weight:600;color:#334155">${esc(period)}</div>
      </div>
    </div>
    <div>
      <div class="label">Payment Method</div>
      <div class="box">
        ${gatewayMark(p.method)}
        <div class="muted" style="margin-top:10px">TrxID: <b style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#0F172A">${esc(p.txn_id)}</b></div>
      </div>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Billing Cycle</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td><b>${esc(p.subscription_packages?.name)}</b><div class="muted">Subscription renewal · ${esc(period)}</div></td>
        <td>${esc(cycle)}</td>
        <td class="num">৳${amount.toLocaleString("en-US")}</td>
      </tr>
      <tr class="total">
        <td colspan="2">TOTAL AMOUNT PAID</td>
        <td class="num">${amountBn}</td>
      </tr>
    </tbody>
  </table>

  <div class="foot">
    <div>
      <div class="muted">Questions? <b style="color:#0F172A">support@orzen.com</b></div>
      <div class="tag">AUTO-GENERATED RECEIPT</div>
    </div>
    <div style="text-align:center">
      <div class="sig">ORZEN</div>
      <div class="sig-line">Digital Signature</div>
    </div>
    <div class="qr">
      ${qr ? `<img src="${qr}" alt="Verification QR"/>` : ""}
      <div>Scan to verify</div>
    </div>
  </div>
</div>
<div class="actions no-print"><button onclick="window.print()">Print / Save PDF</button></div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`);
  win.document.close();
}
