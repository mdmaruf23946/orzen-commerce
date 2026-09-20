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
  customerEmail?: string | null;
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
      { label: "Sent to", value: c.customerEmail ?? "" },
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
  customerEmail?: string | null;
};

export async function tplPaymentRejected(c: RejectedCtx) {
  const html = await renderPlatformEmail({
    title: "Payment verification সফল হয়নি",
    preheader: "Payment verification failed",
    kind: "billing",
    bodyHtml: `<p style="margin:0">${c.ownerName ? `${escapeHtml(c.ownerName)}, ` : ""}<strong>${escapeHtml(c.planName)}</strong> plan-এর ${money(c.amount)} payment verify করা যায়নি।</p>${emailInfoRows([{ label: "Reason", value: c.reason }, { label: "Sent to", value: c.customerEmail ?? "" }])}<p style="margin:0">সঠিক তথ্য দিয়ে আবার submit করুন, অথবা ভুল মনে হলে <a href="mailto:${escapeHtml(c.supportEmail)}" style="color:#315c48">support</a>-এ যোগাযোগ করুন।</p>`,
    actionLabel: "Payment আবার submit করুন",
    actionUrl: c.retryUrl,
    sanitizeBody: false,
  });
  return { subject: "Subscription Verification Failed", html };
}

// ---------- Wallet top-up templates ----------

export type WalletTopupCtx = {
  ownerName?: string | null;
  storeName?: string | null;
  customerEmail: string;
  amount: number;
  method: string;
  txnId?: string | null;
  invoiceNo?: string | null;
  submittedAt?: string | null;
  balanceAfter?: number | null;
  walletUrl: string;
};

export async function tplWalletTopupSubmitted(c: WalletTopupCtx) {
  const html = await renderPlatformEmail({
    title: "Add Fund request গ্রহণ করা হয়েছে",
    preheader: `Wallet top-up request of ${money(c.amount)} received`,
    kind: "billing",
    bodyHtml: `<p style="margin:0 0 12px">${c.ownerName ? `${escapeHtml(c.ownerName)}, ` : ""}আপনার wallet-এ <strong>${money(c.amount)}</strong> যোগ করার request পেয়েছি।</p><p style="margin:0">Payment verify হওয়ার সঙ্গে সঙ্গে balance যোগ হবে এবং আপনি আরেকটি email পাবেন।</p>${emailInfoRows([
      { label: "Store", value: c.storeName ?? "" },
      { label: "Amount", value: money(c.amount) },
      { label: "Method", value: (c.method || "manual").toUpperCase() },
      { label: "Txn ID", value: c.txnId ?? "" },
      { label: "Invoice", value: c.invoiceNo ?? "" },
      { label: "Submitted", value: c.submittedAt ?? "" },
      { label: "Sent to", value: c.customerEmail },
    ])}${emailWarning("এই request আপনি না করে থাকলে সঙ্গে সঙ্গে support-এর সঙ্গে যোগাযোগ করুন।")}`,
    actionLabel: "Wallet দেখুন",
    actionUrl: c.walletUrl,
    sanitizeBody: false,
  });
  return { subject: `Add Fund Request Received — ${money(c.amount)}`, html };
}

export async function tplWalletTopupApproved(c: WalletTopupCtx) {
  const html = await renderPlatformEmail({
    title: "আপনার Add Fund approve হয়েছে",
    preheader: `${money(c.amount)} added to your ORZEN wallet`,
    kind: "billing",
    bodyHtml: `<p style="margin:0 0 12px">সুখবর${c.ownerName ? `, ${escapeHtml(c.ownerName)}` : ""}! আপনার payment verify হয়েছে এবং <strong>${money(c.amount)}</strong> আপনার ORZEN wallet-এ যোগ করা হয়েছে।</p>${emailInfoRows([
      { label: "Store", value: c.storeName ?? "" },
      { label: "Added amount", value: money(c.amount) },
      { label: "New balance", value: c.balanceAfter == null ? "" : money(c.balanceAfter) },
      { label: "Method", value: (c.method || "manual").toUpperCase() },
      { label: "Txn ID", value: c.txnId ?? "" },
      { label: "Invoice", value: c.invoiceNo ?? "" },
      { label: "Approved at", value: c.submittedAt ?? "" },
      { label: "Sent to", value: c.customerEmail },
    ])}<p style="margin:0">এই balance দিয়ে plan কেনা বা auto-renewal চালু রাখা যাবে।</p>`,
    actionLabel: "Wallet balance দেখুন",
    actionUrl: c.walletUrl,
    sanitizeBody: false,
  });
  return { subject: `Wallet Top-up Approved — ${money(c.amount)} Added`, html };
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
  // Deliver before the response finishes — fire-and-forget promises die on the
  // serverless worker, leaving mails stuck in "pending". Failures stay logged
  // (status: failed) and never block the caller.
  try {
    await trySendLog(data.id);
  } catch (e) {
    console.error("[emails] send error", e);
  }
  return data.id;
}

async function callLovableSendEmail(to: string, subject: string, html: string) {
  // Platform (ORZEN) sender — same path used by every other platform email.
  const { sendBrevoEmail } = await import("@/lib/brevo.server");
  await sendBrevoEmail({ to, subject, html, tags: ["platform"] });
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
