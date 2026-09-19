// Store notification email sender: platform queue by default, Resend when configured.
import { enqueueEmail } from "@/lib/emails.server";

export async function sendNotifyEmail(args: {
  provider: "platform" | "resend";
  recipientKind: "merchant" | "customer";
  apiKey?: string | null;
  fromAddress?: string | null;
  to: string;
  subject: string;
  html: string;
}) {
  if (args.recipientKind === "customer" && args.provider !== "resend") {
    throw new Error("Customer email skipped: merchant email provider is not connected");
  }
  if (args.provider === "resend") {
    if (!args.apiKey) throw new Error("Resend API key missing");
    if (!args.fromAddress) throw new Error("Resend from-address missing");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({ from: args.fromAddress, to: [args.to], subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${t.slice(0, 300)}`);
    }
    return { ok: true };
  }
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
