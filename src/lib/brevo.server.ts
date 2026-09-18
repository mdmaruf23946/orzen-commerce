// Server-only Brevo email sender for ORZEN platform notifications.
// All platform mail (manual broadcasts + automations) goes out from
// notify@orzen.top through Brevo's transactional API.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export const PLATFORM_SENDER = {
  name: "ORZEN",
  email: "notify@orzen.top",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand shell shared by every platform email. */
export function platformEmailShell(args: {
  title: string;
  bodyHtml: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  preheader?: string | null;
}): string {
  const { title, bodyHtml } = args;
  const cta =
    args.actionLabel && args.actionUrl
      ? `<div style="margin-top:24px"><a href="${escapeHtml(args.actionUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:14px;">${escapeHtml(args.actionLabel)}</a></div>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111111;">
${args.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(args.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E5E7EB;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:20px 24px;border-bottom:1px solid #E5E7EB;">
        <div style="font-weight:800;font-size:20px;letter-spacing:1px;">ORZEN</div>
      </td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.6;">
        <h1 style="margin:0 0 14px;font-size:19px;font-weight:700;">${escapeHtml(title)}</h1>
        ${bodyHtml}
        ${cta}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #E5E7EB;font-size:12px;color:#6b7280;">
        You are receiving this email from ORZEN — your eCommerce platform.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

export type BrevoSendResult = { ok: true; messageId: string | null };

/** Send one email through Brevo. Throws with the provider status/body on failure. */
export async function sendBrevoEmail(args: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  tags?: string[];
}): Promise<BrevoSendResult> {
  const apiKey = process.env["BREVO_API_KEY"];
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
  if (!args.to || !args.to.includes("@")) throw new Error("Invalid recipient email");

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: PLATFORM_SENDER,
      to: [{ email: args.to, ...(args.toName ? { name: args.toName } : {}) }],
      subject: args.subject.slice(0, 250),
      htmlContent: args.html,
      ...(args.tags?.length ? { tags: args.tags.slice(0, 10) } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { ok: true, messageId: json.messageId ?? null };
}
