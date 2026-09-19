// Server-only receipt email. Uses the Resend connector when the
// RESEND_API_KEY + LOVABLE_API_KEY env vars are present; otherwise
// silently no-ops so the payment flow never fails on email issues.

import { emailInfoRows, escapeHtml, renderPlatformEmail } from "@/lib/brevo.server";

const GATEWAY = "https://connector-gateway.lovable.dev/resend";

type SendOpts = {
  to: string;
  subject: string;
  html: string;
};

export async function sendSubscriptionEmail(opts: SendOpts): Promise<{ sent: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    return { sent: false, error: "Email provider not configured" };
  }
  try {
    const res = await fetch(`${GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "ORZEN Billing <onboarding@resend.dev>",
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${t.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e: any) {
    return { sent: false, error: e?.message ?? "Email send failed" };
  }
}

export async function receiptEmailHtml(args: {
  customerName: string;
  invoiceNo: string;
  packageName: string;
  cycle: string;
  total: number;
  currency: string;
  invoiceUrl?: string | null;
}) {
  return renderPlatformEmail({
    kind: "billing",
    title: "Payment receipt",
    preheader: `Payment received — ${args.invoiceNo}`,
    bodyHtml: `<p style="margin:0 0 12px">${args.customerName ? `${escapeHtml(args.customerName)}, ` : ""}আপনার <strong>${escapeHtml(args.packageName)}</strong> plan (${escapeHtml(args.cycle)})-এর payment পেয়েছি। Subscription এখন active।</p>${emailInfoRows([
      { label: "Invoice", value: args.invoiceNo },
      { label: "Plan", value: args.packageName },
      { label: "Amount", value: `${args.currency} ${args.total.toLocaleString()}` },
    ])}`,
    actionLabel: args.invoiceUrl ? "Invoice দেখুন" : null,
    actionUrl: args.invoiceUrl,
    sanitizeBody: false,
  });
}
