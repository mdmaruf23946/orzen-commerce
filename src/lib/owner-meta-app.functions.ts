// Owner panel — platform Facebook (Meta) app configuration. Saving these
// credentials here switches on "Auto Connect" for every merchant's
// Messenger and WhatsApp integration pages.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

function redirectUriFor(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/meta/oauth-callback`;
}

function publicOrigin(headerHost?: string | null, proto?: string | null) {
  if (headerHost) return `${proto || "https"}://${headerHost}`.replace(/\/$/, "");
  return "https://orzen.top";
}

export const getMetaAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    let origin = "https://orzen.top";
    try {
      origin = publicOrigin(
        getRequestHeader("x-forwarded-host") || getRequestHeader("host"),
        getRequestHeader("x-forwarded-proto"),
      );
    } catch {}
    const { readStoredMetaApp, resolveMetaAppCreds } = await import("@/lib/platform-meta-app.server");
    const stored = await readStoredMetaApp();
    const active = await resolveMetaAppCreds();
    return {
      app_id: stored.appId,
      has_secret: !!stored.appSecret,
      secret_masked: stored.appSecret ? `••••${stored.appSecret.slice(-4)}` : null,
      updated_at: stored.updatedAt,
      configured: !!active,
      from_environment: !!active && !(stored.appId && stored.appSecret),
      redirect_uri: redirectUriFor(origin),
      messenger_scopes: [
        "pages_show_list",
        "pages_messaging",
        "pages_manage_metadata",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_engagement",
        "business_management",
      ],
      whatsapp_scopes: [
        "whatsapp_business_management",
        "whatsapp_business_messaging",
        "business_management",
      ],
    };
  });

export const saveMetaAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        app_id: z.string().trim().min(5).max(64).regex(/^[0-9]+$/, "App ID should be digits only"),
        app_secret: z.string().trim().min(10).max(256).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { readStoredMetaApp, writeStoredMetaApp, verifyMetaAppCreds } = await import(
      "@/lib/platform-meta-app.server"
    );
    const stored = await readStoredMetaApp();
    const secret = data.app_secret || stored.appSecret;
    if (!secret) throw new Error("Enter the App Secret the first time you save.");

    const check = await verifyMetaAppCreds({ appId: data.app_id, appSecret: secret });
    if (!check.ok) throw new Error(check.error);

    await writeStoredMetaApp({ appId: data.app_id, appSecret: data.app_secret ? data.app_secret : null });
    return { ok: true as const };
  });

export const testMetaAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { resolveMetaAppCreds, verifyMetaAppCreds } = await import("@/lib/platform-meta-app.server");
    const creds = await resolveMetaAppCreds();
    if (!creds) return { ok: false as const, error: "No Facebook app is configured yet." };
    const r = await verifyMetaAppCreds(creds);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  });

export const clearMetaAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { clearStoredMetaApp } = await import("@/lib/platform-meta-app.server");
    await clearStoredMetaApp();
    return { ok: true as const };
  });
