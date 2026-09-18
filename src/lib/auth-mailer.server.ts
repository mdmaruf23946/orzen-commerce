// Server-only mailer for ACCOUNT SECURITY email (verification codes,
// password-reset codes, 2FA alerts).
//
// IMPORTANT: this is deliberately a SEPARATE provider from the notification
// mailer (Brevo / notify@orzen.top). Security mail must never depend on the
// promotional/notification pipeline. Primary provider: Mailjet (200 free
// emails per day). Resend is supported as an alternative if its key is set.
import { platformEmailShell } from "@/lib/brevo.server";

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

function codeBlock(code: string): string {
  return `<div style="margin:22px 0;text-align:center"><div style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;padding:14px 22px;border:1px solid #E5E7EB;border-radius:14px;background:#F9FAFB;">${code}</div></div>`;
}

export function verifyCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your ORZEN verification code`,
    html: platformEmailShell({
      title: "Verify your email address",
      preheader: `Your verification code is ${code}`,
      bodyHtml:
        `<p style="margin:0">Use the code below to verify your ORZEN account email.</p>${codeBlock(code)}` +
        `<p style="margin:0;color:#6b7280;font-size:13px">This code expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>`,
    }),
  };
}

export function resetCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your ORZEN password reset code`,
    html: platformEmailShell({
      title: "Reset your password",
      preheader: `Your password reset code is ${code}`,
      bodyHtml:
        `<p style="margin:0">Enter the code below on the password reset page to set a new password.</p>${codeBlock(code)}` +
        `<p style="margin:0;color:#6b7280;font-size:13px">This code expires in ${minutes} minutes. If you did not request a password reset, please secure your account immediately.</p>`,
    }),
  };
}

export function twoFactorChangedEmail(enabled: boolean) {
  return {
    subject: enabled
      ? "Two-factor authentication enabled on your ORZEN account"
      : "Two-factor authentication disabled on your ORZEN account",
    html: platformEmailShell({
      title: enabled ? "Two-factor authentication enabled" : "Two-factor authentication disabled",
      bodyHtml: enabled
        ? `<p style="margin:0">Your account now asks for an authenticator app code at every sign-in. If this was not you, change your password immediately.</p>`
        : `<p style="margin:0">Two-factor authentication was turned off for your account. If this was not you, change your password immediately and turn it back on.</p>`,
      actionLabel: "Open security settings",
      actionUrl: "https://orzen.top/admin/settings/security",
    }),
  };
}
