// Orzen Call (own AI voice platform) settings. Store always comes from the
// signed-in owner; the callback token is never returned except inside the
// owner's own callback URL.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";

async function ownStore(ctx: any) {
  const id = await getOwnedStoreId(ctx.supabase, ctx.userId);
  if (!id) throw new Error("Store not found");
  return id as string;
}

function originOf() {
  try {
    const req = getRequest();
    const u = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") || u.host;
    return `https://${host}`;
  } catch {
    return "https://orzen.top";
  }
}

async function loadRow(storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("voice_provider_connections")
    .select("status,account_info,encrypted_token,connected_at")
    .eq("store_id", storeId)
    .eq("provider", "orzen_call")
    .maybeSingle();
  return { supabaseAdmin, row: data as any };
}

export const getOrzenCallSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { row } = await loadRow(storeId);
    const info = row?.account_info ?? {};
    const token = row?.encrypted_token as string | undefined;
    return {
      connected: row?.status === "connected",
      webhook_url: (info.webhook_url as string) ?? "",
      auto_orders: info.auto_orders !== false,
      auto_products: info.auto_products !== false,
      callback_url: token
        ? `${originOf()}/api/public/orzen-call/callback?s=${storeId}&k=${token}`
        : null,
      connected_at: row?.connected_at ?? null,
    };
  });

const UrlSchema = z.string().trim().max(500).refine((v) => {
  try {
    const u = new URL(v);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && h.includes(".") && h !== "localhost" && !/^[\d.]+$/.test(h);
  } catch {
    return false;
  }
}, "Webhook URL must be a public https:// link.");

export const saveOrzenCallSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ webhook_url: UrlSchema, auto_orders: z.boolean(), auto_products: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin, row } = await loadRow(storeId);
    const { randomBytes } = await import("node:crypto");
    const token = (row?.encrypted_token as string) || randomBytes(24).toString("hex");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("voice_provider_connections").upsert(
      {
        store_id: storeId,
        provider: "orzen_call",
        status: "connected",
        encrypted_token: token,
        token_preview: token.slice(0, 6) + "…",
        account_info: { webhook_url: data.webhook_url, auto_orders: data.auto_orders, auto_products: data.auto_products },
        connected_at: row?.status === "connected" ? undefined : now,
        updated_at: now,
      } as never,
      { onConflict: "store_id,provider" },
    );
    if (error) return { ok: false, message: "Could not save settings. Please try again." };
    return { ok: true, message: "Settings saved" };
  });

export const disconnectOrzenCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("voice_provider_connections")
      .update({ status: "not_connected", encrypted_token: null, updated_at: new Date().toISOString() } as never)
      .eq("store_id", storeId)
      .eq("provider", "orzen_call");
    return { ok: true };
  });
