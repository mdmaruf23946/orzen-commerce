import { pgSafe } from "@/lib/pg-filter";
// Omni Inbox product picker: search the store's catalog and send one product
// (optionally a chosen colour/size variant) to the customer on their own channel.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectedVariant, variantLabel } from "@/lib/messenger-variants";

async function storeIdFor(supabase: any, userId: string) {
  const row = await myStoreRow(supabase, userId, "id", "omni_inbox");
  if (!row) throw new Error("Store not found");
  return row.id as string;
}

export const searchOmniProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    let q = context.supabase
      .from("products")
      .select("id,name,price,old_price,stock,primary_image_url,variants,product_type,status")
      .eq("store_id", storeId)
      .in("status", ["active", "out_of_stock"])
      .order("updated_at", { ascending: false })
      .limit(30);
    const term = data.q?.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(`name.ilike.%${pgSafe(term)}%,sku.ilike.%${pgSafe(term)}%,product_code.ilike.%${pgSafe(term)}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

function absImage(origin: string, raw: string | null) {
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `${origin}/api/img/${String(raw).replace(/^\/+/, "")}`;
}

export const sendOmniProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversationId: z.string().uuid(),
        productId: z.string().uuid(),
        variant: z.record(z.string().max(60), z.string().max(60)).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: conv } = await sb
      .from("ai_conversations")
      .select("id,store_id,channel,external_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.store_id !== storeId) throw new Error("Conversation not found");
    const { data: p } = await sb
      .from("products")
      .select("id,name,slug,price,old_price,stock,short_description,primary_image_url,product_type,variants")
      .eq("store_id", storeId)
      .eq("id", data.productId)
      .maybeSingle();
    if (!p) throw new Error("Product not found");
    const { data: store } = await sb.from("stores").select("slug").eq("id", storeId).maybeSingle();

    const origin = (process.env["PUBLIC_SITE_ORIGIN"] || process.env["PUBLIC_APP_URL"] || "https://orzen.top").replace(/\/$/, "");
    const url = `${origin}/store/${store?.slug ?? "store"}/product/${p.id}`;
    const image = absImage(origin, p.primary_image_url);
    const sel = data.variant && Object.keys(data.variant).length ? data.variant : null;
    const v = sel ? selectedVariant((p as any).variants, sel) : null;
    const price = v?.price ?? p.price;
    const stock = v?.stock ?? p.stock;
    const vText = sel ? variantLabel(sel) : "";
    const orderable = (p.product_type ?? "physical") === "physical";
    const inStock = stock == null || Number(stock) > 0;
    const priceLine = !v && p.old_price ? `৳${price} (আগে ৳${p.old_price})` : `৳${price}`;
    const stockLine = orderable ? (inStock ? "স্টকে আছে" : "স্টকে নেই") : "ওয়েবসাইট থেকে কিনতে হবে";
    const title = p.name;
    const preview = `[product] ${p.name}${vText ? ` (${vText})` : ""}`;

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    let mid: string | null = null;
    let err: string | null = null;

    try {
      if (conv.channel === "messenger") {
        if (!conv.external_id) throw new Error("Conversation has no PSID");
        const { data: integ } = await admin
          .from("messenger_integrations")
          .select("page_access_token,page_access_token_encrypted")
          .eq("store_id", storeId)
          .maybeSingle();
        let token: string | null = (integ as any)?.page_access_token || null;
        if (!token && (integ as any)?.page_access_token_encrypted) {
          const mod = await import("@/lib/crypto/credentials.server");
          token = mod.decryptJSON<string>((integ as any).page_access_token_encrypted);
        }
        if (!token) throw new Error("Messenger is not connected");
        const fb = await import("@/lib/messenger-send.server");
        const res: any = await fb.sendProductCard(token, conv.external_id, {
          title,
          subtitle: [vText, `${priceLine} · ${stockLine}`].filter(Boolean).join(" · "),
          image_url: image ?? undefined,
          buy_url: url,
          product_id: orderable && inStock ? p.id : undefined,
          orderable,
        });
        mid = res?.message_id ?? null;
        if (orderable && inStock) {
          try {
            await fb.sendQuickReplies(token, conv.external_id, vText ? `${vText} — অর্ডার করতে নিচে চাপুন` : "অর্ডার করতে নিচে চাপুন", [
              { title: "🛒 অর্ডার করব", payload: `BUY_${p.id}` },
            ]);
          } catch { /* card already delivered */ }
        }
      } else if (conv.channel === "whatsapp") {
        if (!conv.external_id) throw new Error("Conversation has no WhatsApp number");
        const { data: integ } = await admin
          .from("whatsapp_integrations")
          .select("phone_number_id,access_token_encrypted")
          .eq("store_id", storeId)
          .maybeSingle();
        const mod = await import("@/lib/crypto/credentials.server");
        const token = (integ as any)?.access_token_encrypted ? mod.decryptJSON<string>((integ as any).access_token_encrypted) : null;
        const phoneId = (integ as any)?.phone_number_id;
        if (!token || !phoneId) throw new Error("WhatsApp is not connected");
        const wa = await import("@/lib/whatsapp-send.server");
        const caption = [`*${title}*`, vText, `${priceLine} · ${stockLine}`, p.short_description ?? ""].filter(Boolean).join("\n");
        const res: any = image
          ? await wa.sendWaImage(phoneId, token, conv.external_id, image, caption)
          : await wa.sendWaText(phoneId, token, conv.external_id, caption);
        mid = res?.message_id ?? null;
        if (orderable && inStock) {
          await wa.sendWaButtons(phoneId, token, conv.external_id, "কী করতে চান?", [{ id: `BUY_${p.id}`, title: "Buy now" }]);
        } else {
          await wa.sendWaCtaUrl(phoneId, token, conv.external_id, "ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন", url);
        }
      } else if (conv.channel !== "web") {
        throw new Error("এই চ্যানেলে প্রোডাক্ট পাঠানো যায় না");
      }
    } catch (e) {
      err = (e as Error).message || "Send failed";
    }

    const content =
      conv.channel === "web"
        ? [`🛍️ ${title}`, vText, `${priceLine} · ${stockLine}`].filter(Boolean).join("\n")
        : preview;
    const now = new Date().toISOString();
    await admin.from("ai_messages").insert({
      conversation_id: conv.id,
      role: "assistant",
      direction: "out",
      message_type: "product_card",
      content,
      attachments: [{
        type: "product_card", product_id: p.id, url, image_url: image, variant: sel,
        name: vText ? `${title} (${vText})` : title, price: Number(price), old_price: v ? null : p.old_price, stock: stock == null ? 99 : Number(stock),
      }],
      sent_by_user_id: context.userId,
      delivery_status: err ? "failed" : "sent",
      mid,
      error: err,
    } as any);
    await admin
      .from("ai_conversations")
      .update({
        handoff_mode: "human",
        handoff_at: now,
        handoff_reason: "admin_takeover",
        last_message_at: now,
        last_message_preview: preview.slice(0, 200),
      } as any)
      .eq("id", conv.id);
    if (err) throw new Error(err);
    return { ok: true };
  });
