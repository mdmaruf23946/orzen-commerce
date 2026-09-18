// Server-only sender and shared ORZEN email design system.
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SITE = "https://orzen.top";

export const PLATFORM_SENDER = { name: "ORZEN", email: "notify@orzen.top" };

export type PlatformEmailKind = "security" | "billing" | "platform";
export type PlatformEmailBrand = {
  name: string;
  logoUrl: string | null;
  supportEmail: string;
  whatsapp: string | null;
  website: string;
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function absoluteOrzenUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, SITE);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Restrictive sanitization for owner-authored email content. */
export function sanitizeEmailHtml(value: string): string {
  return String(value ?? "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[\s\S]*?\2/gi, "")
    .replace(/\s+style\s*=\s*(["'])[^"']*(expression\s*\(|url\s*\(\s*javascript:)[^"']*\1/gi, "");
}

let brandCache: { value: PlatformEmailBrand; expires: number } | null = null;

export async function getPlatformEmailBrand(): Promise<PlatformEmailBrand> {
  if (brandCache && brandCache.expires > Date.now()) return brandCache.value;
  const fallback: PlatformEmailBrand = {
    name: "ORZEN",
    logoUrl: null,
    supportEmail: "support@orzen.top",
    whatsapp: null,
    website: SITE,
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [branding, footer, settings] = await Promise.all([
      (supabaseAdmin as any).from("platform_branding").select("assets,placements,published_at").eq("id", "global").maybeSingle(),
      (supabaseAdmin as any).from("platform_footer").select("contact").eq("id", "global").maybeSingle(),
      (supabaseAdmin as any).from("platform_settings").select("settings").eq("id", 1).maybeSingle(),
    ]);
    const b = branding.data ?? {};
    const emailPlacement = b.placements?.email ?? {};
    const assets = b.assets ?? {};
    const chosen = emailPlacement.source === "custom"
      ? emailPlacement.wordmark ?? emailPlacement.logo
      : assets.primaryWordmark ?? assets.primaryLogo ?? assets.darkWordmark ?? assets.darkLogo;
    const contact = footer.data?.contact ?? {};
    const system = settings.data?.settings ?? {};
    const phone = String(contact.phone || system.whatsapp_number || system.support_phone || "").trim();
    const logoUrl = absoluteOrzenUrl(chosen?.url ?? system.logo_url ?? null);
    const support = String(contact.email || system.contact_email || fallback.supportEmail).trim();
    const value: PlatformEmailBrand = {
      name: String(system.platform_name || fallback.name).trim() || fallback.name,
      logoUrl,
      supportEmail: support.includes("@") ? support : fallback.supportEmail,
      whatsapp: phone || null,
      website: SITE,
    };
    brandCache = { value, expires: Date.now() + 60_000 };
    return value;
  } catch {
    return fallback;
  }
}

function kindLabel(kind: PlatformEmailKind): string {
  if (kind === "security") return "নিরাপত্তা • Security";
  if (kind === "billing") return "বিলিং • Billing";
  return "প্ল্যাটফর্ম • Platform";
}

function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function emailCodeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td align="center" style="background:#f3f7f5;border:1px solid #dce7e1;border-radius:8px;padding:18px 12px"><div style="font-family:Consolas,'Courier New',monospace;font-size:30px;line-height:38px;font-weight:800;letter-spacing:8px;color:#102a20">${escapeHtml(code)}</div></td></tr></table>`;
}

export function emailInfoRows(rows: Array<{ label: string; value: string }>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3e8e5;border-radius:8px;margin:18px 0">${rows
    .filter((row) => row.value)
    .map((row, index) => `<tr><td style="padding:10px 14px;color:#64716b;font-size:13px;${index ? "border-top:1px solid #edf0ee;" : ""}width:38%">${escapeHtml(row.label)}</td><td style="padding:10px 14px;color:#16231d;font-size:14px;font-weight:600;${index ? "border-top:1px solid #edf0ee;" : ""}">${escapeHtml(row.value)}</td></tr>`)
    .join("")}</table>`;
}

export function emailWarning(text: string): string {
  return `<div style="margin:18px 0 0;background:#fff8e8;border-left:4px solid #e8a317;padding:12px 14px;color:#614a16;font-size:13px;line-height:20px">${escapeHtml(text)}</div>`;
}

/** Pure renderer; callers may supply a loaded brand or use safe fallbacks. */
export function platformEmailShell(args: {
  title: string;
  bodyHtml: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  preheader?: string | null;
  kind?: PlatformEmailKind;
  brand?: PlatformEmailBrand;
  sanitizeBody?: boolean;
}): string {
  const brand = args.brand ?? { name: "ORZEN", logoUrl: null, supportEmail: "support@orzen.top", whatsapp: null, website: SITE };
  const actionUrl = absoluteOrzenUrl(args.actionUrl);
  const cta = args.actionLabel && actionUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td bgcolor="#163f2c" style="border-radius:6px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:12px 20px;font-size:14px;font-weight:700">${escapeHtml(args.actionLabel)}</a></td></tr></table>`
    : "";
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="150" alt="${escapeHtml(brand.name)}" style="display:block;max-width:150px;max-height:44px;width:auto;height:auto;border:0">`
    : `<div style="font-size:23px;line-height:30px;font-weight:800;color:#153d2b">${escapeHtml(brand.name)}</div>`;
  const wa = brand.whatsapp ? whatsappUrl(brand.whatsapp) : null;
  const contactLinks = [
    `<a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:#315c48;text-decoration:none">${escapeHtml(brand.supportEmail)}</a>`,
    wa ? `<a href="${escapeHtml(wa)}" style="color:#315c48;text-decoration:none">WhatsApp</a>` : "",
    `<a href="${escapeHtml(brand.website)}" style="color:#315c48;text-decoration:none">orzen.top</a>`,
  ].filter(Boolean).join(" &nbsp;•&nbsp; ");
  const body = args.sanitizeBody === false ? args.bodyHtml : sanitizeEmailHtml(args.bodyHtml);
  const year = new Date().getUTCFullYear();
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(args.title)}</title></head>
<body style="margin:0;padding:0;background:#eef2ef;font-family:Arial,'Noto Sans Bengali',sans-serif;color:#16231d">
${args.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(args.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#eef2ef"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce3df">
  <tr><td style="height:5px;background:#163f2c;font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:22px 28px;border-bottom:1px solid #e6ebe8"><table role="presentation" width="100%"><tr><td>${logo}</td><td align="right" style="font-size:11px;line-height:16px;font-weight:700;color:#527060;text-transform:uppercase">${kindLabel(args.kind ?? "platform")}</td></tr></table></td></tr>
  <tr><td style="padding:30px 28px 32px;font-size:15px;line-height:24px;color:#24342c"><h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#10271c">${escapeHtml(args.title)}</h1>${body}${cta}</td></tr>
  <tr><td style="padding:20px 28px;background:#f7f9f8;border-top:1px solid #e6ebe8;text-align:center;font-size:12px;line-height:19px;color:#64716b">
    <div style="margin-bottom:7px">সহায়তা দরকার? Need help? ${contactLinks}</div>
    <div style="margin-bottom:7px">${escapeHtml(brand.name)} কখনো email-এ আপনার password বা সম্পূর্ণ security code চাইবে না।</div>
    <div>© ${year} ${escapeHtml(brand.name)}. এই emailটি আপনার account বা platform activity-এর জন্য পাঠানো হয়েছে।</div>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export async function renderPlatformEmail(args: Omit<Parameters<typeof platformEmailShell>[0], "brand">): Promise<string> {
  return platformEmailShell({ ...args, brand: await getPlatformEmailBrand() });
}

export type BrevoSendResult = { ok: true; messageId: string | null };

export async function sendBrevoEmail(args: { to: string; toName?: string | null; subject: string; html: string; tags?: string[] }): Promise<BrevoSendResult> {
  const apiKey = process.env["BREVO_API_KEY"];
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
  if (!args.to || !args.to.includes("@")) throw new Error("Invalid recipient email");
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
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