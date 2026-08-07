// WhatsApp Cloud API sender (server-only).
export async function sendWhatsapp(args: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}) {
  const to = args.to.replace(/[^\d]/g, "");
  const res = await fetch(`https://graph.facebook.com/v20.0/${args.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: args.text.slice(0, 4000) },
    }),
  });
  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${body.slice(0, 300)}`);
  return { ok: true };
}
