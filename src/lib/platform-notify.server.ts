// Server-only ORZEN platform automation emails (welcome, login alert,
// subscription, landing page). Every send is switch-controlled from the
// Owner Panel and never throws into the calling business flow.
import { escapeHtml, emailInfoRows, renderPlatformEmail, sendBrevoEmail } from "@/lib/brevo.server";

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

  const html = await renderPlatformEmail({
    title: args.title,
    bodyHtml: args.bodyHtml,
    actionLabel: args.actionLabel ?? null,
    actionUrl: args.actionUrl ?? null,
    preheader: args.preheader ?? null,
    kind: args.key === "login_alert" ? "security" : args.key === "subscription" ? "billing" : "platform",
    sanitizeBody: false,
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
      p(`স্বাগতম${args.ownerName ? `, ${escapeHtml(args.ownerName)}` : ""}।`) +
      p(`<strong>${escapeHtml(args.storeName)}</strong> তৈরি হয়েছে এবং এখন online: <a href="${storeUrl}" style="color:#315c48">${escapeHtml(args.slug)}.orzen.top</a>।`) +
      p(`পণ্য, delivery ও payment setup করে বিক্রি শুরু করুন। Your free trial is active.`),
    actionLabel: "Dashboard খুলুন",
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
      p(`আপনার ORZEN account-এ একটি নতুন sign-in শনাক্ত হয়েছে।`) +
      emailInfoRows([
        { label: "সময় / Time", value: args.when },
        { label: "ডিভাইস / Device", value: args.device ?? "" },
        { label: "IP address", value: args.ip ?? "" },
      ]) +
      p(`এটি আপনি হলে কিছু করতে হবে না। না হলে অবিলম্বে password পরিবর্তন করুন।`),
    actionLabel: "Password পরিবর্তন করুন",
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
      p(`ধন্যবাদ—আপনার payment পাওয়া গেছে এবং subscription এখন active।`) +
      emailInfoRows([
        { label: "Plan", value: args.planName },
        { label: "পরিশোধ / Amount", value: amount ?? "" },
        { label: "Invoice", value: args.invoiceNo ?? "" },
        { label: "মেয়াদ / Valid until", value: args.expiresAt ? new Date(args.expiresAt).toDateString() : "" },
      ]),
    actionLabel: "Billing দেখুন",
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
      p(`আপনার landing page <strong>${escapeHtml(args.pageTitle)}</strong> publish হয়েছে এবং এখন order নিতে প্রস্তুত।`) +
      (args.pageUrl ? p(`Live link: <a href="${escapeHtml(args.pageUrl)}" style="color:#315c48">${escapeHtml(args.pageUrl)}</a>`) : ""),
    actionLabel: "Landing pages দেখুন",
    actionUrl: `${SITE}/admin/landing-pages`,
  });
}
