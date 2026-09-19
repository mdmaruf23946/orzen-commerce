// Server-only email helpers for ORZEN subscription payment flow.
// Uses Lovable Emails when a workspace domain is configured. Until then,
// rows are queued in `email_logs` with a clear last_error so the owner can
// retry from the admin panel once email is enabled.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailInfoRows, emailWarning, escapeHtml, renderPlatformEmail } from "@/lib/brevo.server";

function money(n: number): string {
  return `৳${Number(n || 0).toLocaleString()}`;
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

export async function tplPaymentSubmittedAdmin(c: SubmittedCtx) {
  const html = await renderPlatformEmail({
    title: "নতুন subscription payment এসেছে",
    preheader: `New payment request from ${c.storeName}`,
    kind: "billing",
    bodyHtml: `<p style="margin:0">একজন merchant manual payment request জমা দিয়েছেন। Review করে সিদ্ধান্ত নিন।</p>${emailInfoRows([
      { label: "Store", value: c.storeName }, { label: "Owner", value: c.ownerName ?? "—" },
      { label: "Email", value: c.customerEmail }, { label: "Plan", value: c.planName },
      { label: "Duration", value: c.cycleLabel }, { label: "Amount", value: money(c.amount) },
      { label: "Method", value: c.method.toUpperCase() }, { label: "Sender", value: c.senderNumber },
      { label: "Txn ID", value: c.txnId }, { label: "Submitted", value: c.submittedAt },
      { label: "Note", value: c.customerNote ?? "" },
    ])}`,
    actionLabel: "Payment review করুন",
    actionUrl: c.reviewUrl,
    sanitizeBody: false,
  });
  return { subject: "New Subscription Payment Received", html };
}

export async function tplPaymentSubmittedCustomer(c: SubmittedCtx) {
  const html = await renderPlatformEmail({
    title: "Payment request গ্রহণ করা হয়েছে",
    preheader: "Payment received — under verification",
    kind: "billing",
    bodyHtml: `<p style="margin:0 0 12px">${c.ownerName ? `${escapeHtml(c.ownerName)}, ` : ""}আপনার <strong>${escapeHtml(c.planName)}</strong> (${escapeHtml(c.cycleLabel)}) payment request পেয়েছি।</p><p style="margin:0">Payment এখন verification-এর অধীনে আছে। সিদ্ধান্ত হলে আরেকটি email পাবেন।</p>${emailInfoRows([
      { label: "Amount", value: money(c.amount) }, { label: "Method", value: c.method.toUpperCase() },
      { label: "Txn ID", value: c.txnId }, { label: "Submitted", value: c.submittedAt },
    ])}${emailWarning("এই payment আপনি জমা না দিলে support-এর সঙ্গে যোগাযোগ করুন।")}`,
    sanitizeBody: false,
  });
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

export async function tplPaymentApproved(c: ApprovedCtx) {
  const html = await renderPlatformEmail({
    title: "আপনার ORZEN subscription এখন active",
    preheader: `Subscription active — ${c.planName}`,
    kind: "billing",
    bodyHtml: `<p style="margin:0">সুখবর${c.ownerName ? `, ${escapeHtml(c.ownerName)}` : ""}! আপনার payment verify হয়েছে এবং subscription চালু হয়েছে।</p>${emailInfoRows([
      { label: "Plan", value: c.planName }, { label: "Amount", value: money(c.amount) },
      { label: "Activation", value: c.activationDate }, { label: "Expires", value: c.expiryDate },
      { label: "Invoice", value: c.invoiceNo }, { label: "Store URL", value: c.storeUrl },
    ])}`,
    actionLabel: "Dashboard-এ যান",
    actionUrl: c.loginUrl,
    sanitizeBody: false,
  });
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

export async function tplPaymentRejected(c: RejectedCtx) {
  const html = await renderPlatformEmail({
    title: "Payment verification সফল হয়নি",
    preheader: "Payment verification failed",
    kind: "billing",
    bodyHtml: `<p style="margin:0">${c.ownerName ? `${escapeHtml(c.ownerName)}, ` : ""}<strong>${escapeHtml(c.planName)}</strong> plan-এর ${money(c.amount)} payment verify করা যায়নি।</p>${emailInfoRows([{ label: "Reason", value: c.reason }])}<p style="margin:0">সঠিক তথ্য দিয়ে আবার submit করুন, অথবা ভুল মনে হলে <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:#315c48">support</a>-এ যোগাযোগ করুন।</p>`,
    actionLabel: "Payment আবার submit করুন",
    actionUrl: c.retryUrl,
    sanitizeBody: false,
  });
  return { subject: "Subscription Verification Failed", html };
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
