// Server-only email helpers for ORZEN subscription payment flow.
// Uses Lovable Emails when a workspace domain is configured. Until then,
// rows are queued in `email_logs` with a clear last_error so the owner can
// retry from the admin panel once email is enabled.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BRAND = {
  name: "ORZEN",
  color: "#111111",
  border: "#E5E7EB",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return `৳${Number(n || 0).toLocaleString()}`;
}

function shell(inner: string, preheader = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND.name}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.color};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
      <tr><td style="padding:20px 24px;border-bottom:1px solid ${BRAND.border};">
        <div style="font-weight:800;font-size:20px;letter-spacing:0.5px;">${BRAND.name}</div>
      </td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.55;">${inner}</td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid ${BRAND.border};font-size:12px;color:#6b7280;">
        You're receiving this email from ${BRAND.name} — the modern eCommerce platform.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND.color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;">${escapeHtml(label)}</a>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:40%;">${escapeHtml(label)}</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${value}</td></tr>`;
}

// ---------- Template payloads ----------

export type SubmittedCtx = {
  storeName: string;
  ownerName?: string | null;
  customerEmail: string;
  planName: string;
  cycleLabel: string;
  amount: number;
  method: string;
  senderNumber: string;
  txnId: string;
  submittedAt: string;
  customerNote?: string | null;
  reviewUrl: string;
};

export function tplPaymentSubmittedAdmin(c: SubmittedCtx) {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">New Subscription Payment Received</h2>
     <p style="margin:0 0 16px;">A store owner just submitted a manual payment request. Review it in the Winner Admin panel.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND.border};border-radius:12px;padding:8px 14px;margin:0 0 20px;">
       ${row("Store", escapeHtml(c.storeName))}
       ${row("Owner", escapeHtml(c.ownerName ?? "—"))}
       ${row("Email", escapeHtml(c.customerEmail))}
       ${row("Plan", escapeHtml(c.planName))}
       ${row("Duration", escapeHtml(c.cycleLabel))}
       ${row("Amount", money(c.amount))}
       ${row("Method", escapeHtml(c.method.toUpperCase()))}
       ${row("Sender", escapeHtml(c.senderNumber))}
       ${row("Txn ID", `<span style="font-family:monospace">${escapeHtml(c.txnId)}</span>`)}
       ${row("Submitted", escapeHtml(c.submittedAt))}
       ${c.customerNote ? row("Note", escapeHtml(c.customerNote)) : ""}
     </table>
     <div>${button(c.reviewUrl, "Review Payment Request")}</div>`,
    `New payment request from ${c.storeName}`,
  );
  return { subject: "New Subscription Payment Received", html };
}

export function tplPaymentSubmittedCustomer(c: SubmittedCtx) {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">Payment Request Received</h2>
     <p style="margin:0 0 12px;">Hi${c.ownerName ? " " + escapeHtml(c.ownerName) : ""}, we have successfully received your payment request for <b>${escapeHtml(c.planName)}</b> (${escapeHtml(c.cycleLabel)}).</p>
     <p style="margin:0 0 16px;">Your payment is currently under verification. You will receive another email once your subscription has been approved or rejected.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND.border};border-radius:12px;padding:8px 14px;margin:0 0 20px;">
       ${row("Amount", money(c.amount))}
       ${row("Method", escapeHtml(c.method.toUpperCase()))}
       ${row("Txn ID", `<span style="font-family:monospace">${escapeHtml(c.txnId)}</span>`)}
       ${row("Submitted", escapeHtml(c.submittedAt))}
     </table>
     <p style="margin:0;color:#6b7280;font-size:13px;">If you did not submit this payment, please contact support.</p>`,
    `Payment received — under verification`,
  );
  return { subject: "Payment Request Received", html };
}

export type ApprovedCtx = {
  ownerName?: string | null;
  planName: string;
  activationDate: string;
  expiryDate: string;
  storeUrl: string;
  loginUrl: string;
  invoiceNo: string;
  amount: number;
};

export function tplPaymentApproved(c: ApprovedCtx) {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">Your ORZEN Subscription is Now Active</h2>
     <p style="margin:0 0 16px;">Great news${c.ownerName ? ", " + escapeHtml(c.ownerName) : ""}! Your payment has been verified and your subscription is now active.</p>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND.border};border-radius:12px;padding:8px 14px;margin:0 0 20px;">
       ${row("Plan", escapeHtml(c.planName))}
       ${row("Amount", money(c.amount))}
       ${row("Activation", escapeHtml(c.activationDate))}
       ${row("Expires", escapeHtml(c.expiryDate))}
       ${row("Invoice", `<span style="font-family:monospace">${escapeHtml(c.invoiceNo)}</span>`)}
       ${row("Store URL", `<a href="${escapeHtml(c.storeUrl)}" style="color:${BRAND.color};">${escapeHtml(c.storeUrl)}</a>`)}
     </table>
     <div>${button(c.loginUrl, "Log in to Dashboard")}</div>`,
    `Subscription active — ${c.planName}`,
  );
  return { subject: "Your ORZEN Subscription is Now Active", html };
}

export type RejectedCtx = {
  ownerName?: string | null;
  planName: string;
  amount: number;
  reason: string;
  supportEmail: string;
  retryUrl: string;
};

export function tplPaymentRejected(c: RejectedCtx) {
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">Subscription Verification Failed</h2>
     <p style="margin:0 0 12px;">Hi${c.ownerName ? " " + escapeHtml(c.ownerName) : ""}, we were unable to verify your recent payment for <b>${escapeHtml(c.planName)}</b> (${money(c.amount)}).</p>
     <div style="background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;border-radius:12px;padding:12px 14px;margin:0 0 20px;">
       <div style="font-weight:600;margin-bottom:4px;">Reason</div>
       <div>${escapeHtml(c.reason)}</div>
     </div>
     <p style="margin:0 0 16px;">Please resubmit your payment with the correct details, or contact support if you believe this is a mistake.</p>
     <p style="margin:0 0 20px;">Support: <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:${BRAND.color};">${escapeHtml(c.supportEmail)}</a></p>
     <div>${button(c.retryUrl, "Resubmit Payment")}</div>`,
    `Payment verification failed`,
  );
  return { subject: "Subscription Verification Failed", html };
}

// ---------- Digital delivery ----------

export type DownloadReadyCtx = {
  storeName: string;
  customerName?: string | null;
  orderRef: string;
  downloadUrl: string;
  items: { name: string; label?: string | null; version?: string | null }[];
  licenses?: string[];
  instructions?: string[];
};

export function tplDigitalDownloadReady(c: DownloadReadyCtx) {
  const list = c.items
    .map(
      (i) =>
        `<li style="margin:0 0 6px;"><b>${escapeHtml(i.name)}</b>${
          i.label ? ` — ${escapeHtml(i.label)}` : ""
        }${i.version ? ` <span style="color:#6b7280">(v${escapeHtml(i.version)})</span>` : ""}</li>`,
    )
    .join("");
  const licenseBlock = c.licenses?.length
    ? `<div style="background:#f8fafc;border:1px solid ${BRAND.border};border-radius:12px;padding:12px 14px;margin:0 0 20px;">
         <div style="font-weight:600;margin-bottom:6px;">Your license key${c.licenses.length > 1 ? "s" : ""}</div>
         ${c.licenses.map((k) => `<div style="font-family:monospace;font-size:14px;">${escapeHtml(k)}</div>`).join("")}
       </div>`
    : "";
  const instructionBlock = c.instructions?.length
    ? `<div style="margin:0 0 20px;color:#374151;font-size:14px;">${c.instructions
        .map((t) => `<p style="margin:0 0 6px;">${escapeHtml(t)}</p>`)
        .join("")}</div>`
    : "";
  const html = shell(
    `<h2 style="margin:0 0 12px;font-size:20px;">Your download is ready 🎉</h2>
     <p style="margin:0 0 12px;">Hi${c.customerName ? " " + escapeHtml(c.customerName) : ""}, thanks for your purchase from <b>${escapeHtml(c.storeName)}</b>. Order <b>${escapeHtml(c.orderRef)}</b> is confirmed and your files are unlocked.</p>
     <ul style="margin:0 0 20px;padding-left:18px;font-size:14px;">${list}</ul>
     ${licenseBlock}
     ${instructionBlock}
     <div>${button(c.downloadUrl, "Download now")}</div>`,
    `Your files from ${c.storeName} are ready`,
  );
  return { subject: `Your download is ready — ${c.storeName}`, html };
}

// ---------- Queue + send ----------

type EnqueueArgs = {
  to: string;
  template: string;
  subject: string;
  html: string;
  payload?: Record<string, unknown>;
  relatedPaymentId?: string | null;
};

export async function enqueueEmail(args: EnqueueArgs): Promise<string | null> {
  const { data, error } = await (supabaseAdmin.from("email_logs") as any)
    .insert({
      to_email: args.to,
      template: args.template,
      subject: args.subject,
      html: args.html,
      payload: args.payload ?? {},
      related_payment_id: args.relatedPaymentId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[emails] enqueue failed", error);
    return null;
  }
  // Attempt delivery immediately (fire and forget)
  trySendLog(data.id).catch((e) => console.error("[emails] send error", e));
  return data.id;
}

async function callLovableSendEmail(to: string, subject: string, html: string) {
  // Uses Lovable Emails infra if configured. If the RPC/edge function isn't
  // available yet, throws — caller records the error on the log row.
  const url = `${process.env.SUPABASE_URL}/functions/v1/send-email`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`send-email returned ${res.status}: ${t.slice(0, 200)}`);
  }
}

export async function trySendLog(logId: string): Promise<{ ok: boolean; error?: string }> {
  const sb: any = supabaseAdmin;
  const { data: log } = await sb.from("email_logs").select("*").eq("id", logId).maybeSingle();
  if (!log) return { ok: false, error: "log not found" };
  if (log.status === "sent") return { ok: true };

  try {
    await callLovableSendEmail(log.to_email, log.subject, log.html);
    await sb
      .from("email_logs")
      .update({
        status: "sent",
        attempts: (log.attempts ?? 0) + 1,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", logId);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    await sb
      .from("email_logs")
      .update({
        status: "failed",
        attempts: (log.attempts ?? 0) + 1,
        last_error: msg,
      })
      .eq("id", logId);
    return { ok: false, error: msg };
  }
}
