// WhatsApp Cloud API senders + Graph helpers. Server-only.
// Mirrors src/lib/messenger-send.server.ts for the WhatsApp channel.

const GRAPH = "https://graph.facebook.com/v20.0";

export type WaSendResult = { message_id?: string };

export function normalizeWaNumber(raw: string) {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  // Bangladesh local format 01XXXXXXXXX → 8801XXXXXXXXX
  if (/^01\d{9}$/.test(d)) d = `88${d}`;
  return d;
}

/** Turns a raw Graph error into a short, admin-safe message. */
export function friendlyWaError(raw: string) {
  const s = String(raw ?? "");
  if (/131030|allowed list/i.test(s)) return "This number is not in your Meta test recipient list. Add it in Meta → WhatsApp → API Setup → To, then try again.";
  if (/131047|24 hour|re-?engagement/i.test(s)) return "The 24-hour messaging window is closed. Send an approved template instead.";
  if (/\b190\b|access token|expired/i.test(s)) return "Access token is invalid or expired. Reconnect WhatsApp.";
  if (/131026|not.*whatsapp/i.test(s)) return "This number is not reachable on WhatsApp.";
  if (/80007|rate limit|too many/i.test(s)) return "WhatsApp rate limit reached. Try again shortly.";
  if (/132000|132001|template/i.test(s)) return "Template problem: the template name/language is missing or not approved.";
  if (/100|Unsupported/i.test(s)) return "WhatsApp rejected the request. Check the Phone Number ID and permissions.";
  return "WhatsApp request failed. Please try again.";
}

async function post(phoneNumberId: string, token: string, body: any): Promise<WaSendResult> {
  const r = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = j?.error ?? {};
    throw new Error([err.message || `WhatsApp send failed (${r.status})`, err.code ? `code:${err.code}` : null].filter(Boolean).join(" "));
  }
  return { message_id: j?.messages?.[0]?.id };
}

export function sendWaText(phoneNumberId: string, token: string, to: string, text: string) {
  return post(phoneNumberId, token, {
    to: normalizeWaNumber(to),
    type: "text",
    text: { preview_url: true, body: String(text).slice(0, 4000) },
  });
}

export function sendWaImage(phoneNumberId: string, token: string, to: string, link: string, caption?: string) {
  return post(phoneNumberId, token, {
    to: normalizeWaNumber(to),
    type: "image",
    image: { link, ...(caption ? { caption: caption.slice(0, 1000) } : {}) },
  });
}

export function sendWaMedia(
  phoneNumberId: string,
  token: string,
  to: string,
  kind: "image" | "video" | "audio" | "document",
  link: string,
  caption?: string,
) {
  const payload: any = { link };
  if (caption && (kind === "image" || kind === "video" || kind === "document")) payload.caption = caption.slice(0, 1000);
  return post(phoneNumberId, token, { to: normalizeWaNumber(to), type: kind, [kind]: payload });
}

/** Up to 3 quick-reply buttons (WhatsApp limit). */
export function sendWaButtons(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
) {
  return post(phoneNumberId, token, {
    to: normalizeWaNumber(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: String(body).slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** Interactive "call to action" URL button. Falls back to plain text + URL. */
export async function sendWaCtaUrl(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
  url: string,
  label = "View site",
) {
  try {
    return await post(phoneNumberId, token, {
      to: normalizeWaNumber(to),
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: String(body).slice(0, 1024) },
        action: { name: "cta_url", parameters: { display_text: label.slice(0, 20), url } },
      },
    });
  } catch {
    return sendWaText(phoneNumberId, token, to, `${body}\n${url}`);
  }
}

export function sendWaTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  name: string,
  language = "en",
  components?: any[],
) {
  return post(phoneNumberId, token, {
    to: normalizeWaNumber(to),
    type: "template",
    template: { name, language: { code: language }, ...(components?.length ? { components } : {}) },
  });
}

export async function markWaRead(phoneNumberId: string, token: string, messageId: string) {
  try {
    await post(phoneNumberId, token, { status: "read", message_id: messageId });
  } catch {
    /* non-fatal */
  }
}

/** Phone number profile — used for Test Connection. */
export async function getWaPhoneNumber(phoneNumberId: string, token: string) {
  const r = await fetch(
    `${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,platform_type`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `WhatsApp check failed (${r.status})`);
  return j as { display_phone_number?: string; verified_name?: string; quality_rating?: string };
}

export async function listWaTemplates(wabaId: string, token: string) {
  const r = await fetch(
    `${GRAPH}/${encodeURIComponent(wabaId)}/message_templates?fields=id,name,language,category,status,components&limit=100`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Template sync failed (${r.status})`);
  return (j?.data ?? []) as any[];
}

/** Downloads WhatsApp-hosted media metadata (URL is short-lived, needs the token). */
export async function getWaMediaUrl(mediaId: string, token: string) {
  const r = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return null;
  return (j?.url as string) ?? null;
}
