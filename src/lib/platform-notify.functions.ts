// Owner-facing email automation switches + the login security alert trigger.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listEmailAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("platform_email_automations")
      .select("key,label,description,enabled,updated_at")
      .order("key");
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const setEmailAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_email_automations")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a Brevo test email to the signed-in owner so delivery can be checked. */
export const sendTestPlatformEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const to = (context.claims as any)?.email as string | undefined;
    if (!to) throw new Error("Your account has no email address");
    const { sendBrevoEmail, platformEmailShell } = await import("@/lib/brevo.server");
    await sendBrevoEmail({
      to,
      subject: "ORZEN test notification",
      html: platformEmailShell({
        title: "Test notification",
        bodyHtml: `<p style="margin:0 0 12px">This is a test email from your ORZEN Owner Panel. Email delivery is working.</p>`,
      }),
      tags: ["platform", "test"],
    });
    return { ok: true, to };
  });

/** Called right after a successful sign-in to send the security alert. */
export const notifySignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ device: z.string().max(200).nullish() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    if (!email) return { sent: false };
    const { notifyLoginAlert } = await import("@/lib/platform-notify.server");
    let ip: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      ip = getRequestHeader("cf-connecting-ip") ?? null;
    } catch {
      ip = null;
    }
    const res = await notifyLoginAlert({
      email,
      ownerName: ((context.claims as any)?.user_metadata?.full_name as string) ?? null,
      when: new Date().toUTCString(),
      device: data.device ?? null,
      ip,
    });
    return { sent: res.sent };
  });
