// Server-only receipt email. Uses the Resend connector when the
// RESEND_API_KEY + LOVABLE_API_KEY env vars are present; otherwise
// silently no-ops so the payment flow never fails on email issues.

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

export function receiptEmailHtml(args: {
  customerName: string;
  invoiceNo: string;
  packageName: string;
  cycle: string;
  total: number;
  currency: string;
  invoiceUrl?: string | null;
}) {
  return `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#3b82f6">Payment received</h2>
    <p>Hi ${args.customerName || "there"},</p>
    <p>We've received your payment for the <b>${args.packageName}</b> plan (${args.cycle}). Your subscription is now active.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 12px;color:#6b7280">Invoice</td><td style="padding:6px 12px"><b>${args.invoiceNo}</b></td></tr>
      <tr><td style="padding:6px 12px;color:#6b7280">Amount</td><td style="padding:6px 12px"><b>${args.currency} ${args.total.toLocaleString()}</b></td></tr>
    </table>
    ${args.invoiceUrl ? `<p><a href="${args.invoiceUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View invoice</a></p>` : ""}
    <p style="color:#6b7280;font-size:12px;margin-top:24px">— ORZEN</p>
  </div>`;
}
