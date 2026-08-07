// Best-effort multi-channel notification dispatcher (server-only).
import { loadSettings, readSecret } from "@/lib/notify-settings.server";
import { NOTIFY_EVENTS, type NotifyEventKey } from "@/lib/notify-settings";
import { sendWhatsapp } from "@/lib/notify/whatsapp.server";
import { sendSms } from "@/lib/notify/sms.server";
import { sendNotifyEmail } from "@/lib/notify/email.server";

type Sb = any;

export type DispatchInput = {
  storeId: string;
  event: NotifyEventKey;
  subject: string;
  /** Plain-text body used for WhatsApp/SMS and wrapped in HTML for email. */
  message: string;
  customer?: { phone?: string | null; email?: string | null } | null;
};

function html(subject: string, message: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
    <h2 style="font-size:16px;margin:0 0 8px">${escapeHtml(subject)}</h2>
    <p style="white-space:pre-line;margin:0">${escapeHtml(message)}</p>
  </div>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function eventLabel(event: NotifyEventKey) {
  return NOTIFY_EVENTS.find((e) => e.key === event)?.label ?? event;
}

/** Never throws — notification failures must not roll back the originating action. */
export async function dispatchNotification(sb: Sb, input: DispatchInput) {
  try {
    const settings = await loadSettings(sb, input.storeId);
    const jobs: Promise<unknown>[] = [];

    // WhatsApp
    const wa: any = settings.whatsapp;
    if (wa?.enabled) {
      const token = readSecret(wa.access_token_enc);
      const audience = wa.events?.[input.event];
      if (token && wa.phone_number_id) {
        const targets: string[] = [];
        if (audience?.admin && wa.number) targets.push(wa.number);
        if (audience?.customer && input.customer?.phone) targets.push(input.customer.phone);
        for (const to of targets) {
          jobs.push(
            sendWhatsapp({ phoneNumberId: wa.phone_number_id, accessToken: token, to, text: input.message }),
          );
        }
      }
    }

    // SMS
    const sms: any = settings.sms;
    if (sms?.enabled) {
      const apiKey = readSecret(sms.api_key_enc);
      const audience = sms.events?.[input.event];
      if (apiKey && sms.sender_id) {
        const targets: string[] = [];
        if (audience?.admin && sms.number) targets.push(sms.number);
        if (audience?.customer && input.customer?.phone) targets.push(input.customer.phone);
        for (const to of targets) {
          jobs.push(sendSms({ apiKey, senderId: sms.sender_id, to, text: input.message }));
        }
      }
    }

    // Email
    const em: any = settings.email;
    if (em?.enabled) {
      const audience = em.events?.[input.event];
      const targets: string[] = [];
      if (audience?.admin && em.address) targets.push(em.address);
      if (audience?.customer && input.customer?.email) targets.push(input.customer.email);
      const apiKey = readSecret(em.api_key_enc);
      for (const to of targets) {
        jobs.push(
          sendNotifyEmail({
            provider: em.provider === "resend" ? "resend" : "platform",
            apiKey,
            fromAddress: em.from_address,
            to,
            subject: input.subject,
            html: html(input.subject, input.message),
          }),
        );
      }
    }

    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error("[notify] some channels failed", failed.map((f: any) => String(f.reason?.message ?? f.reason)));
    }
    return { attempted: jobs.length, failed: failed.length };
  } catch (e) {
    console.error("[notify] dispatch error", (e as Error).message);
    return { attempted: 0, failed: 0 };
  }
}
