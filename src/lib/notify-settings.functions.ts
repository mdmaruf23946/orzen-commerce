// Store-scoped notification settings: read, per-channel save, per-channel test.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EventMapSchema = z.record(
  z.string(),
  z.object({ admin: z.boolean().default(false), customer: z.boolean().default(false) }),
);

const SaveSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("whatsapp"),
    enabled: z.boolean(),
    number: z.string().trim().max(30).default(""),
    phone_number_id: z.string().trim().max(60).default(""),
    template_name: z.string().trim().max(80).default(""),
    access_token: z.string().trim().max(600).optional().nullable(),
    events: EventMapSchema,
  }),
  z.object({
    channel: z.literal("email"),
    enabled: z.boolean(),
    provider: z.enum(["platform", "resend"]),
    address: z.string().trim().max(200).default(""),
    from_address: z.string().trim().max(200).default(""),
    api_key: z.string().trim().max(300).optional().nullable(),
    events: EventMapSchema,
  }),
  z.object({
    channel: z.literal("sms"),
    enabled: z.boolean(),
    number: z.string().trim().max(30).default(""),
    sender_id: z.string().trim().max(40).default(""),
    api_key: z.string().trim().max(300).optional().nullable(),
    events: EventMapSchema,
  }),
]);

async function myStoreId(supabase: any, userId: string): Promise<string> {
  const data = await myStoreRow(supabase, userId, "id", "notifications");
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const { loadSettings, redact } = await import("@/lib/notify-settings.server");
    return redact(await loadSettings(context.supabase, storeId));
  });

export const saveNotificationChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const { loadSettings, saveSettings, redact, encryptSecret } = await import(
      "@/lib/notify-settings.server"
    );
    const settings: any = await loadSettings(context.supabase, storeId);
    const prev = settings[data.channel] ?? {};
    const next: any = { ...prev, enabled: data.enabled, events: data.events };

    if (data.channel === "whatsapp") {
      next.provider = "cloud_api";
      next.number = data.number;
      next.phone_number_id = data.phone_number_id;
      next.template_name = data.template_name;
      if (data.access_token) next.access_token_enc = encryptSecret(data.access_token);
    } else if (data.channel === "email") {
      next.provider = data.provider;
      next.address = data.address;
      next.from_address = data.from_address;
      if (data.api_key) next.api_key_enc = encryptSecret(data.api_key);
    } else {
      next.provider = "bulksmsbd";
      next.number = data.number;
      next.sender_id = data.sender_id;
      if (data.api_key) next.api_key_enc = encryptSecret(data.api_key);
    }
    next.status = { ...(prev.status ?? {}), last_error: null };
    settings[data.channel] = next;
    await saveSettings(context.supabase, storeId, settings);
    return redact(settings);
  });

export const testNotificationChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { channel: "whatsapp" | "email" | "sms" }) =>
    z.object({ channel: z.enum(["whatsapp", "email", "sms"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const { loadSettings, saveSettings, readSecret, redact } = await import(
      "@/lib/notify-settings.server"
    );
    const settings: any = await loadSettings(context.supabase, storeId);
    const ch = settings[data.channel] ?? {};
    const text = "Test notification from your Merchant Panel. Notifications are working.";

    let error: string | null = null;
    try {
      if (data.channel === "whatsapp") {
        const token = readSecret(ch.access_token_enc);
        if (!token || !ch.phone_number_id || !ch.number) throw new Error("WhatsApp is not fully configured");
        const { sendWhatsapp } = await import("@/lib/notify/whatsapp.server");
        await sendWhatsapp({ phoneNumberId: ch.phone_number_id, accessToken: token, to: ch.number, text });
      } else if (data.channel === "sms") {
        const apiKey = readSecret(ch.api_key_enc);
        if (!apiKey || !ch.sender_id || !ch.number) throw new Error("SMS is not fully configured");
        const { sendSms } = await import("@/lib/notify/sms.server");
        await sendSms({ apiKey, senderId: ch.sender_id, to: ch.number, text });
      } else {
        if (!ch.address) throw new Error("Notification email address is required");
        const { sendNotifyEmail } = await import("@/lib/notify/email.server");
        await sendNotifyEmail({
          provider: ch.provider === "resend" ? "resend" : "platform",
          apiKey: readSecret(ch.api_key_enc),
          fromAddress: ch.from_address,
          to: ch.address,
          subject: "Test notification",
          html: `<p>${text}</p>`,
        });
      }
    } catch (e) {
      error = (e as Error).message.slice(0, 400);
    }

    ch.status = {
      state: error ? "error" : "connected",
      last_error: error,
      last_tested_at: new Date().toISOString(),
    };
    settings[data.channel] = ch;
    await saveSettings(context.supabase, storeId, settings);
    return { ok: !error, error, settings: redact(settings) };
  });
