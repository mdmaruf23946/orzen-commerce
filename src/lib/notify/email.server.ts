// Store notification email sender.
// Platform (ORZEN) email is merchant-inbox only. Customer email always goes
// through the merchant's own provider/server.
import { enqueueEmail } from "@/lib/emails.server";
import type { EmailProvider } from "@/lib/notify-settings";

export type SendNotifyEmailArgs = {
  provider: EmailProvider;
  recipientKind: "merchant" | "customer";
  apiKey?: string | null;
  fromAddress?: string | null;
  fromName?: string | null;
  mailgunDomain?: string | null;
  mailgunRegion?: "us" | "eu" | null;
  smtpEndpoint?: string | null;
  to: string;
  subject: string;
  html: string;
};

function requireOwnSender(args: SendNotifyEmailArgs) {
  if (!args.apiKey) throw new Error("Email provider API key missing");
  if (!args.fromAddress) throw new Error("From address missing");
}

function fromHeader(args: SendNotifyEmailArgs) {
  return args.fromName ? `${args.fromName} <${args.fromAddress}>` : String(args.fromAddress);
}

async function fail(res: Response, label: string) {
  const t = await res.text().catch(() => "");
  throw new Error(`${label} ${res.status}: ${t.slice(0, 300)}`);
}

export async function sendNotifyEmail(args: SendNotifyEmailArgs) {
  const { provider } = args;

  if (args.recipientKind === "customer" && provider === "platform") {
    throw new Error("Customer email skipped: connect your own email provider first");
  }

  if (provider === "platform") {
    if (args.recipientKind !== "merchant") {
      throw new Error("Customer email cannot use the ORZEN platform sender");
    }
    const id = await enqueueEmail({
      to: args.to,
      template: "store_notification",
      subject: args.subject,
      html: args.html,
    });
    if (!id) throw new Error("Platform email queue rejected the message");
    return { ok: true };
  }

  if (provider === "resend") {
    requireOwnSender(args);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({ from: fromHeader(args), to: [args.to], subject: args.subject, html: args.html }),
    });
    if (!res.ok) await fail(res, "Resend");
    return { ok: true };
  }

  if (provider === "sendgrid") {
    requireOwnSender(args);
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: args.fromAddress, ...(args.fromName ? { name: args.fromName } : {}) },
        subject: args.subject,
        content: [{ type: "text/html", value: args.html }],
      }),
    });
    if (!res.ok) await fail(res, "SendGrid");
    return { ok: true };
  }

  if (provider === "mailgun") {
    requireOwnSender(args);
    if (!args.mailgunDomain) throw new Error("Mailgun sending domain missing");
    const host = args.mailgunRegion === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
    const body = new URLSearchParams({
      from: fromHeader(args),
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    const res = await fetch(`https://${host}/v3/${encodeURIComponent(args.mailgunDomain)}/messages`, {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`api:${args.apiKey}`)}` },
      body,
    });
    if (!res.ok) await fail(res, "Mailgun");
    return { ok: true };
  }

  if (provider === "brevo") {
    requireOwnSender(args);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": String(args.apiKey) },
      body: JSON.stringify({
        sender: { email: args.fromAddress, ...(args.fromName ? { name: args.fromName } : {}) },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
      }),
    });
    if (!res.ok) await fail(res, "Brevo");
    return { ok: true };
  }

  // Merchant's own mail server, reached through an HTTPS relay endpoint.
  requireOwnSender(args);
  if (!args.smtpEndpoint) throw new Error("Mail server endpoint missing");
  let url: URL;
  try {
    url = new URL(args.smtpEndpoint);
  } catch {
    throw new Error("Mail server endpoint must be a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("Mail server endpoint must use https");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      from: fromHeader(args),
      from_email: args.fromAddress,
      from_name: args.fromName ?? "",
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) await fail(res, "Mail server");
  return { ok: true };
}
