// Server-only ORZEN platform automation emails (welcome, login alert,
// subscription, landing page). Every send is switch-controlled from the
// Owner Panel and never throws into the calling business flow.
import { sendBrevoEmail, platformEmailShell } from "@/lib/brevo.server";

export type AutomationKey = "welcome" | "login_alert" | "subscription" | "landing_page";

const SITE = "https://orzen.top";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Owner switch for one automation. Defaults to on when the row is missing. */
export async function automationEnabled(key: AutomationKey): Promise<boolean> {
  try {
    const sb = await admin();
    const { data } = await sb
      .from("platform_email_automations")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    if (!data) return true;
    return data.enabled !== false;
  } catch {
    return false;
  }
}

async function logSend(template: string, to: string, status: string, error?: string) {
  try {
    const sb = await admin();
    await sb.from("email_send_log").insert({
      template_name: template,
      recipient_email: to,
      status,
      error_message: error ?? null,
    });
  } catch {
    // Logging must never break a business flow.
  }
}

/** Send an automation email if its switch is on. Never throws. */
export async function sendAutomationEmail(args: {
  key: AutomationKey;
  to: string | null | undefined;
  toName?: string | null;
  subject: string;
  title: string;
  bodyHtml: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  preheader?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!args.to || !args.to.includes("@")) return { sent: false, reason: "no_email" };
  if (args.to.endsWith("@demo-orzen.test")) return { sent: false, reason: "demo_account" };
  if (!(await automationEnabled(args.key))) return { sent: false, reason: "disabled" };

  const html = platformEmailShell({
    title: args.title,
    bodyHtml: args.bodyHtml,
    actionLabel: args.actionLabel ?? null,
    actionUrl: args.actionUrl ?? null,
    preheader: args.preheader ?? null,
  });

  try {
    await sendBrevoEmail({
      to: args.to,
      toName: args.toName ?? null,
      subject: args.subject,
      html,
      tags: ["platform", args.key],
    });
    await logSend(`automation-${args.key}`, args.to, "sent");
    return { sent: true };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 400);
    console.error(`[platform-notify] ${args.key} failed`, msg);
    await logSend(`automation-${args.key}`, args.to, "failed", msg);
    return { sent: false, reason: msg };
  }
}

function p(text: string): string {
  return `<p style="margin:0 0 12px">${text}</p>`;
}

// ---------- Ready-made automations ----------

export async function notifyWelcome(args: {
  email: string | null | undefined;
  ownerName?: string | null;
  storeName: string;
  slug: string;
}) {
  const storeUrl = `https://${args.slug}.orzen.top`;
  return sendAutomationEmail({
    key: "welcome",
    to: args.email,
    toName: args.ownerName ?? null,
    subject: `Welcome to ORZEN — ${args.storeName} is live`,
    title: `Your store is live 🎉`,
    preheader: `${args.storeName} is ready at ${args.slug}.orzen.top`,
    bodyHtml:
      p(`Hi ${args.ownerName || "there"},`) +
      p(`<strong>${args.storeName}</strong> has been created and is already online at <a href="${storeUrl}">${args.slug}.orzen.top</a>.`) +
      p(`Add your products, set up delivery and payments, and start selling. Your free trial is active right now.`),
    actionLabel: "Open my dashboard",
    actionUrl: `${SITE}/admin`,
  });
}

export async function notifyLoginAlert(args: {
  email: string | null | undefined;
  ownerName?: string | null;
  when: string;
  device?: string | null;
  ip?: string | null;
}) {
  return sendAutomationEmail({
    key: "login_alert",
    to: args.email,
    toName: args.ownerName ?? null,
    subject: "New sign-in to your ORZEN account",
    title: "New sign-in detected",
    preheader: "A sign-in to your ORZEN account was just recorded.",
    bodyHtml:
      p(`We recorded a sign-in to your ORZEN account.`) +
      `<table style="width:100%;font-size:14px;margin:8px 0 4px">
        <tr><td style="padding:6px 0;color:#6b7280;width:38%">Time</td><td style="padding:6px 0;font-weight:600">${args.when}</td></tr>
        ${args.device ? `<tr><td style="padding:6px 0;color:#6b7280">Device</td><td style="padding:6px 0;font-weight:600">${args.device}</td></tr>` : ""}
        ${args.ip ? `<tr><td style="padding:6px 0;color:#6b7280">IP address</td><td style="padding:6px 0;font-weight:600">${args.ip}</td></tr>` : ""}
      </table>` +
      p(`If this was you, no action is needed. If it was not, change your password immediately.`),
    actionLabel: "Change password",
    actionUrl: `${SITE}/auth`,
  });
}

export async function notifySubscription(args: {
  email: string | null | undefined;
  ownerName?: string | null;
  planName: string;
  amount?: number | null;
  expiresAt?: string | null;
  invoiceNo?: string | null;
}) {
  const amount = args.amount != null ? `৳${Number(args.amount).toLocaleString()}` : null;
  return sendAutomationEmail({
    key: "subscription",
    to: args.email,
    toName: args.ownerName ?? null,
    subject: `Your ORZEN ${args.planName} plan is active`,
    title: "Subscription confirmed",
    preheader: `${args.planName} plan activated on your ORZEN account.`,
    bodyHtml:
      p(`Thank you — your payment was received and your plan is now active.`) +
      `<table style="width:100%;font-size:14px;margin:8px 0 4px">
        <tr><td style="padding:6px 0;color:#6b7280;width:38%">Plan</td><td style="padding:6px 0;font-weight:600">${args.planName}</td></tr>
        ${amount ? `<tr><td style="padding:6px 0;color:#6b7280">Amount paid</td><td style="padding:6px 0;font-weight:600">${amount}</td></tr>` : ""}
        ${args.invoiceNo ? `<tr><td style="padding:6px 0;color:#6b7280">Invoice</td><td style="padding:6px 0;font-weight:600">${args.invoiceNo}</td></tr>` : ""}
        ${args.expiresAt ? `<tr><td style="padding:6px 0;color:#6b7280">Valid until</td><td style="padding:6px 0;font-weight:600">${new Date(args.expiresAt).toDateString()}</td></tr>` : ""}
      </table>`,
    actionLabel: "View billing",
    actionUrl: `${SITE}/admin/billing`,
  });
}

export async function notifyLandingPagePublished(args: {
  email: string | null | undefined;
  ownerName?: string | null;
  pageTitle: string;
  pageUrl?: string | null;
}) {
  return sendAutomationEmail({
    key: "landing_page",
    to: args.email,
    toName: args.ownerName ?? null,
    subject: `Landing page published — ${args.pageTitle}`,
    title: "Your landing page is live",
    preheader: `${args.pageTitle} has been published.`,
    bodyHtml:
      p(`Your landing page <strong>${args.pageTitle}</strong> is now published and can receive orders.`) +
      (args.pageUrl ? p(`Live link: <a href="${args.pageUrl}">${args.pageUrl}</a>`) : ""),
    actionLabel: "Manage landing pages",
    actionUrl: `${SITE}/admin/landing-pages`,
  });
}
