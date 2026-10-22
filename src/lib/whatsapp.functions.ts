// WhatsApp Integration — store-admin server functions.
// Mirrors the Messenger integration functions; every read/write is scoped to
// the signed-in owner's own store.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicOrigin(): string {
  try {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {}
  const explicit = process.env["PUBLIC_APP_URL"] || process.env["VITE_APP_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://orzen.top";
}

async function getOwnedStoreId(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id", "whatsapp");
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

async function loadRow(context: any) {
  const storeId = await getOwnedStoreId(context.supabase, context.userId);
  const { data } = await context.supabase
    .from("whatsapp_integrations")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  return { storeId, row: data as any };
}

async function decrypt(enc: string | null) {
  if (!enc) return null;
  try {
    const mod = await import("@/lib/crypto/credentials.server");
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

async function encrypt(value: string) {
  const mod = await import("@/lib/crypto/credentials.server");
  return mod.encryptJSON(value);
}

async function newVerifyToken() {
  const { randomBytes } = await import("crypto");
  return `wa_${randomBytes(24).toString("hex")}`;
}

/** Loads the decrypted token + phone number id for the owner's store. */
async function credentials(context: any) {
  const { storeId, row } = await loadRow(context);
  if (!row) throw new Error("WhatsApp is not connected yet");
  const token = await decrypt(row.access_token_encrypted);
  if (!token || !row.phone_number_id) throw new Error("WhatsApp credentials are missing. Reconnect WhatsApp.");
  return { storeId, row, token, phoneNumberId: row.phone_number_id as string };
}

// ---------- Read ----------

export const getWhatsappIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { storeId, row } = await loadRow(context);
    if (!row) {
      const { data: created } = await context.supabase
        .from("whatsapp_integrations")
        .insert({ store_id: storeId, verify_token: await newVerifyToken(), status: "not_connected" })
        .select("*")
        .single();
      row = created as any;
    } else if (!row.verify_token) {
      const { data: updated } = await context.supabase
        .from("whatsapp_integrations")
        .update({ verify_token: await newVerifyToken() })
        .eq("store_id", storeId)
        .select("*")
        .single();
      if (updated) row = updated as any;
    }

    const { data: lastEvent } = await context.supabase
      .from("whatsapp_webhook_events")
      .select("event_type,received_at,error")
      .eq("store_id", storeId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      connected: row.status === "connected",
      status: row.status as string,
      webhook_url: `${publicOrigin()}/api/public/whatsapp/webhook`,
      verify_token: row.verify_token,
      phone_number_id: row.phone_number_id,
      waba_id: row.waba_id,
      phone_number: row.phone_number,
      display_name: row.display_name,
      quality_rating: row.quality_rating,
      has_token: !!row.access_token_encrypted,
      has_app_secret: !!row.app_secret_encrypted,
      connected_at: row.connected_at,
      last_verified_at: row.last_verified_at,
      last_error: row.last_error,
      delivery_failures: row.delivery_failures ?? 0,
      ai_auto_reply: row.ai_auto_reply,
      human_takeover: row.human_takeover,
      conversation_history: row.conversation_history,
      order_detection: row.order_detection,
      product_recommendation: row.product_recommendation,
      faq_reply: row.faq_reply,
      webhook: {
        last_at: lastEvent?.received_at ?? row.last_webhook_at ?? null,
        last_type: lastEvent?.event_type ?? row.last_webhook_type ?? null,
        last_error: lastEvent?.error ?? row.last_webhook_error ?? null,
      },
    };
  });

// ---------- Connect / disconnect ----------

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone_number_id: z.string().trim().min(4).max(64),
        waba_id: z.string().trim().max(64).optional().nullable(),
        access_token: z.string().trim().min(10).max(1000).optional().nullable(),
        app_secret: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { storeId, row } = await loadRow(context);
    const token = data.access_token ? data.access_token : await decrypt(row?.access_token_encrypted ?? null);
    if (!token) throw new Error("Access token is required");
    // The app secret is recommended (it enables webhook signature verification) but optional,
    // so stores connected before this requirement can still update their settings.



    // Another store must not claim the same phone number id.
    const { data: clash } = await context.supabase
      .from("whatsapp_integrations")
      .select("store_id")
      .eq("phone_number_id", data.phone_number_id)
      .neq("store_id", storeId)
      .maybeSingle();
    if (clash) throw new Error("This WhatsApp phone number is already connected to another store");

    const patch: Record<string, any> = {
      store_id: storeId,
      phone_number_id: data.phone_number_id,
      waba_id: data.waba_id || row?.waba_id || null,
      verify_token: row?.verify_token || (await newVerifyToken()),
      status: "connecting",
      last_error: null,
    };
    if (data.access_token) patch["access_token_encrypted"] = await encrypt(data.access_token);
    if (data.app_secret) patch["app_secret_encrypted"] = await encrypt(data.app_secret);

    // Verify against the Graph API before marking it connected.
    const { getWaPhoneNumber, friendlyWaError } = await import("@/lib/whatsapp-send.server");
    try {
      const info = await getWaPhoneNumber(data.phone_number_id, token);
      patch["phone_number"] = info.display_phone_number ?? null;
      patch["display_name"] = info.verified_name ?? null;
      patch["quality_rating"] = info.quality_rating ?? null;
      patch["status"] = "connected";
      patch["connected_at"] = new Date().toISOString();
      patch["last_verified_at"] = new Date().toISOString();
      patch["delivery_failures"] = 0;
      // Subscribe our app to the WABA so incoming messages reach the webhook.
      const waba = data.waba_id || row?.waba_id;
      if (waba) {
        await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(waba)}/subscribed_apps`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        }).catch(() => null);
      }
    } catch (e) {
      patch["status"] = "error";
      patch["last_error"] = friendlyWaError((e as Error).message);
    }

    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .upsert(patch, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    if (patch["status"] === "error") throw new Error(patch["last_error"]);
    return { ok: true, status: patch["status"] };
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        app_secret_encrypted: null,
        connected_at: null,
        quality_rating: null,
      })
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId, token, phoneNumberId } = await credentials(context);
    const { getWaPhoneNumber, friendlyWaError } = await import("@/lib/whatsapp-send.server");
    try {
      const info = await getWaPhoneNumber(phoneNumberId, token);
      await context.supabase
        .from("whatsapp_integrations")
        .update({
          status: "connected",
          phone_number: info.display_phone_number ?? null,
          display_name: info.verified_name ?? null,
          quality_rating: info.quality_rating ?? null,
          last_verified_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("store_id", storeId);
      return { ok: true, ...info };
    } catch (e) {
      const msg = friendlyWaError((e as Error).message);
      await context.supabase
        .from("whatsapp_integrations")
        .update({ status: "error", last_error: msg })
        .eq("store_id", storeId);
      throw new Error(msg);
    }
  });

export const sendWhatsappTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to: z.string().trim().min(6).max(20),
        message: z.string().trim().min(1).max(900).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { storeId, token, phoneNumberId } = await credentials(context);
    // Test only to a number that already messaged this store on WhatsApp.
    {
      const tail = data.to.replace(/\D/g, "").slice(-10);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: seen } = await (supabaseAdmin as any)
        .from("whatsapp_jobs").select("id").eq("store_id", storeId).like("sender_id", `%${tail}`).limit(1);
      if (tail.length < 10 || !seen?.length)
        throw new Error("এই নম্বর থেকে আগে আপনার WhatsApp-এ মেসেজ আসতে হবে। আগে নিজের ফোন থেকে একটি মেসেজ পাঠান, তারপর test করুন।");
    }
    const { sendWaText, friendlyWaError } = await import("@/lib/whatsapp-send.server");
    try {
      const res = await sendWaText(
        phoneNumberId,
        token,
        data.to,
        data.message || "✅ ORZEN test message — your WhatsApp connection is working.",
      );
      await context.supabase
        .from("whatsapp_integrations")
        .update({ last_error: null, last_verified_at: new Date().toISOString() })
        .eq("store_id", storeId);
      return { ok: true, message_id: res.message_id ?? null };
    } catch (e) {
      const msg = friendlyWaError((e as Error).message);
      await context.supabase.from("whatsapp_integrations").update({ last_error: msg }).eq("store_id", storeId);
      throw new Error(msg);
    }
  });

export const regenerateWhatsappVerifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const verify_token = await newVerifyToken();
    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .update({ verify_token })
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { verify_token };
  });

export const updateWhatsappAiFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ai_auto_reply: z.boolean().optional(),
        human_takeover: z.boolean().optional(),
        conversation_history: z.boolean().optional(),
        order_detection: z.boolean().optional(),
        product_recommendation: z.boolean().optional(),
        faq_reply: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { error } = await context.supabase.from("whatsapp_integrations").update(data).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearWhatsappLastError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    await context.supabase
      .from("whatsapp_integrations")
      .update({ last_error: null, delivery_failures: 0 })
      .eq("store_id", storeId);
    return { ok: true };
  });

// ---------- Templates ----------

export const listWhatsappTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("whatsapp_templates")
      .select("id,name,language,category,status,body_preview,synced_at")
      .eq("store_id", storeId)
      .order("name", { ascending: true });
    return data ?? [];
  });

export const syncWhatsappTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { storeId, row, token } = await credentials(context);
    if (!row.waba_id) throw new Error("WhatsApp Business Account ID is required to sync templates");
    const { listWaTemplates, friendlyWaError } = await import("@/lib/whatsapp-send.server");
    let list: any[] = [];
    try {
      list = await listWaTemplates(row.waba_id, token);
    } catch (e) {
      throw new Error(friendlyWaError((e as Error).message));
    }
    const rows = list.map((t) => ({
      store_id: storeId,
      template_id: String(t.id ?? ""),
      name: String(t.name ?? ""),
      language: String(t.language ?? "en"),
      category: t.category ?? null,
      status: String(t.status ?? "PENDING"),
      body_preview:
        (t.components ?? []).find((c: any) => c.type === "BODY")?.text?.slice(0, 500) ?? null,
      synced_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await context.supabase
        .from("whatsapp_templates")
        .upsert(rows, { onConflict: "store_id,name,language" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: rows.length };
  });

// ---------- Webhook diagnostics ----------

export const listWhatsappWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("whatsapp_webhook_events")
      .select("id,event_type,error,received_at")
      .eq("store_id", storeId)
      .order("received_at", { ascending: false })
      .limit(10);
    return data ?? [];
  });

// ---------- Analytics ----------

export const getWhatsappAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const conv = (extra?: (q: any) => any) => {
      let q = context.supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("channel", "whatsapp");
      return extra ? extra(q) : q;
    };
    const msg = (dir: "in" | "out") =>
      context.supabase
        .from("ai_messages")
        .select("id, ai_conversations!inner(store_id,channel)", { count: "exact", head: true })
        .eq("ai_conversations.store_id", storeId)
        .eq("ai_conversations.channel", "whatsapp")
        .eq("direction", dir);

    const [total, recent, unread, ai, human, ordered, sent, received] = await Promise.all([
      conv(),
      conv((q) => q.gte("created_at", since)),
      conv((q) => q.gt("unread_count", 0)),
      conv((q) => q.eq("handoff_mode", "ai")),
      conv((q) => q.eq("handoff_mode", "human")),
      conv((q) => q.gt("total_orders", 0)),
      msg("out"),
      msg("in"),
    ]);

    const totalCount = total.count ?? 0;
    const orderCount = ordered.count ?? 0;
    return {
      conversations: totalCount,
      new_conversations: recent.count ?? 0,
      unread: unread.count ?? 0,
      ai_handled: ai.count ?? 0,
      human_handled: human.count ?? 0,
      orders: orderCount,
      conversion_rate: totalCount ? Math.round((orderCount / totalCount) * 1000) / 10 : 0,
      messages_sent: sent.count ?? 0,
      messages_received: received.count ?? 0,
    };
  });
