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

export type AuthMailProvider = "mailjet" | "resend" | "none";

export function authMailProvider(): AuthMailProvider {
  if (process.env["MAILJET_API_KEY"] && process.env["MAILJET_SECRET_KEY"]) return "mailjet";
  if (process.env["RESEND_API_KEY"]) return "resend";
  return "none";
}

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
          Subject: args.subject,
          HTMLPart: args.html,
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
      subject: args.subject,
      html: args.html,
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

/** Send one security email. Throws with the provider status/body on failure. */
export async function sendAuthEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | null; provider: AuthMailProvider }> {
  if (!args.to || !args.to.includes("@")) throw new Error("Invalid recipient email");
  const provider = authMailProvider();
  if (provider === "none") {
    throw new Error(
      "Security email provider is not configured yet (MAILJET_API_KEY / MAILJET_SECRET_KEY missing).",
    );
  }
  const sent = provider === "mailjet" ? await sendViaMailjet(args) : await sendViaResend(args);
  return { ...sent, provider };
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
