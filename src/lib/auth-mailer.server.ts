// Server-only mailer for ACCOUNT SECURITY email (verification codes,
// password-reset codes, 2FA alerts).
//
// IMPORTANT: this is deliberately a SEPARATE provider from the notification
// mailer (Brevo / notify@orzen.top). Security mail must never depend on the
// promotional/notification pipeline. Primary provider: Mailjet (200 free
// emails per day). Resend is supported as an alternative if its key is set.
import { emailCodeBlock, emailWarning, renderPlatformEmail } from "@/lib/brevo.server";

export const AUTH_SENDER = {
  name: "ORZEN Security",
  email: process.env["AUTH_EMAIL_FROM"] ?? "auth@orzen.top",
};

export type AuthMailProvider = "resend" | "mailjet" | "none";

function hasResend() {
  return Boolean(process.env["RESEND_API_KEY"]);
}
function hasMailjet() {
  return Boolean(process.env["MAILJET_API_KEY"] && process.env["MAILJET_SECRET_KEY"]);
}

/** Primary provider; the other one is used automatically as fallback. */
export function authMailProvider(): AuthMailProvider {
  if (hasResend()) return "resend";
  if (hasMailjet()) return "mailjet";
  return "none";
}

/** Deliverability: a real plain-text alternative lowers the spam score a lot. */
function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

export const AUTH_REPLY_TO = process.env["AUTH_EMAIL_REPLY_TO"] ?? "support@orzen.top";

async function sendViaMailjet(args: { to: string; subject: string; html: string }) {
  const key = process.env["MAILJET_API_KEY"]!;
  const secret = process.env["MAILJET_SECRET_KEY"]!;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: AUTH_SENDER.email, Name: AUTH_SENDER.name },
          To: [{ Email: args.to }],
          ReplyTo: { Email: AUTH_REPLY_TO },
          Subject: args.subject,
          HTMLPart: args.html,
          TextPart: toPlainText(args.html),
          Headers: { "X-Entity-Ref-ID": crypto.randomUUID(), Precedence: "bulk" },
        },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Mailjet failed [${res.status}]: ${body.slice(0, 300)}`);
  return { messageId: null as string | null };
}

async function sendViaResend(args: { to: string; subject: string; html: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `${AUTH_SENDER.name} <${AUTH_SENDER.email}>`,
      to: [args.to],
      reply_to: AUTH_REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: toPlainText(args.html),
      headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend failed [${res.status}]: ${body.slice(0, 300)}`);
  let id: string | null = null;
  try {
    id = (JSON.parse(body) as { id?: string }).id ?? null;
  } catch {
    /* ignore */
  }
  return { messageId: id };
}

/**
 * Send one security email with automatic provider failover: Resend first,
 * Mailjet second (or whichever is configured). If the first provider is out of
 * quota / blocked / erroring, the next one is tried before giving up.
 */
export async function sendAuthEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | null; provider: AuthMailProvider }> {
  if (!args.to || !args.to.includes("@")) throw new Error("Invalid recipient email");

  const chain: AuthMailProvider[] = [];
  if (hasResend()) chain.push("resend");
  if (hasMailjet()) chain.push("mailjet");

  if (chain.length === 0) {
    throw new Error(
      "Security email provider is not configured yet (RESEND_API_KEY or MAILJET_API_KEY/MAILJET_SECRET_KEY missing).",
    );
  }

  const errors: string[] = [];
  for (const provider of chain) {
    try {
      const sent = provider === "resend" ? await sendViaResend(args) : await sendViaMailjet(args);
      if (errors.length) console.warn(`[auth-mailer] fallback to ${provider}: ${errors.join(" | ")}`);
      return { ...sent, provider };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`All security email providers failed: ${errors.join(" | ")}`);
}

export async function verifyCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} — ORZEN email verification code`,
    html: await renderPlatformEmail({
      kind: "security",
      title: "আপনার email verify করুন",
      preheader: `ORZEN verification code: ${code}`,
      bodyHtml:
        `<p style="margin:0">আপনার ORZEN account email নিশ্চিত করতে নিচের <strong>verification code</strong> ব্যবহার করুন।</p>${emailCodeBlock(code)}` +
        `<p style="margin:0;color:#64716b;font-size:13px">কোডটি ${minutes} মিনিট পর্যন্ত কার্যকর। Code expires in ${minutes} minutes.</p>` +
        emailWarning("আপনি এই অনুরোধ না করলে codeটি ব্যবহার করবেন না এবং emailটি উপেক্ষা করুন।"),
      sanitizeBody: false,
    }),
  };
}

export async function resetCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} — ORZEN password reset code`,
    html: await renderPlatformEmail({
      kind: "security",
      title: "Password reset করুন",
      preheader: `ORZEN password reset code: ${code}`,
      bodyHtml:
        `<p style="margin:0">নতুন password সেট করতে reset page-এ নিচের codeটি দিন।</p>${emailCodeBlock(code)}` +
        `<p style="margin:0;color:#64716b;font-size:13px">কোডটি ${minutes} মিনিট পর্যন্ত কার্যকর। Code expires in ${minutes} minutes.</p>` +
        emailWarning("আপনি password reset চাননি? Codeটি ব্যবহার করবেন না এবং account security পরীক্ষা করুন।"),
      sanitizeBody: false,
    }),
  };
}

export async function twoFactorChangedEmail(enabled: boolean) {
  return {
    subject: enabled
      ? "Two-factor authentication enabled on your ORZEN account"
      : "Two-factor authentication disabled on your ORZEN account",
    html: await renderPlatformEmail({
      kind: "security",
      title: enabled ? "Two-factor authentication চালু হয়েছে" : "Two-factor authentication বন্ধ হয়েছে",
      bodyHtml: enabled
        ? `<p style="margin:0">আপনার account-এ এখন প্রতিবার sign-in-এর সময় authenticator code লাগবে।</p>${emailWarning("এটি আপনি না করলে এখনই password পরিবর্তন করুন।")}`
        : `<p style="margin:0">আপনার account থেকে two-factor authentication বন্ধ করা হয়েছে।</p>${emailWarning("এটি আপনি না করলে এখনই password পরিবর্তন করে 2FA আবার চালু করুন।")}`,
      actionLabel: "Security settings খুলুন",
      actionUrl: "https://orzen.top/admin/settings/security",
      sanitizeBody: false,
    }),
  };
}
