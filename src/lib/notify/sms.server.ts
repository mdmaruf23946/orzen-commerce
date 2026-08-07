// BulkSMSBD HTTP sender (server-only).
export async function sendSms(args: {
  apiKey: string;
  senderId: string;
  to: string;
  text: string;
}) {
  const to = args.to.replace(/[^\d]/g, "");
  const url = new URL("http://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", args.apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", to);
  url.searchParams.set("senderid", args.senderId);
  url.searchParams.set("message", args.text.slice(0, 800));
  const res = await fetch(url.toString(), { method: "GET" });
  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`SMS API ${res.status}: ${body.slice(0, 200)}`);
  // BulkSMSBD replies with a JSON body carrying response_code 202 on success.
  try {
    const j = JSON.parse(body);
    const code = Number(j?.response_code ?? j?.code);
    if (code && code !== 202) throw new Error(`SMS provider: ${j?.error_message ?? body.slice(0, 200)}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("SMS provider")) throw e;
  }
  return { ok: true };
}
