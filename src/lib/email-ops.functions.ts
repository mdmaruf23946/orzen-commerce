// Owner-only email delivery activity + platform email configuration status.
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

export type DeliveryRow = {
  id: string;
  created_at: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
};

/** Recent platform email sends, with optional status/template filters. */
export const listEmailDeliveryLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(100),
        status: z.enum(["all", "sent", "failed"]).default("all"),
        search: z.string().max(200).nullish(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("email_send_log")
      .select("id,created_at,template_name,recipient_email,status,error_message,message_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search?.trim()) q = q.ilike("recipient_email", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as DeliveryRow[] };
  });

/** 30-day totals and per-template breakdown of platform email sends. */
export const emailDeliveryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("email_send_log")
      .select("template_name,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as { template_name: string; status: string; created_at: string }[];
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    let sent = 0;
    let failed = 0;
    let last24h = 0;
    const byTemplate = new Map<string, { sent: number; failed: number }>();
    for (const r of list) {
      const ok = r.status === "sent";
      if (ok) sent++;
      else failed++;
      if (new Date(r.created_at).getTime() >= dayAgo) last24h++;
      const t = byTemplate.get(r.template_name) ?? { sent: 0, failed: 0 };
      if (ok) t.sent++;
      else t.failed++;
      byTemplate.set(r.template_name, t);
    }
    return {
      sent,
      failed,
      total: list.length,
      last24h,
      lastSendAt: list[0]?.created_at ?? null,
      templates: [...byTemplate.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.sent + b.failed - (a.sent + a.failed)),
    };
  });

/** Live sending configuration: Brevo account/plan state and the automation switches. */
export const getEmailConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { PLATFORM_SENDER } = await import("@/lib/brevo.server");

    const apiKey = process.env["BREVO_API_KEY"];
    let provider: {
      connected: boolean;
      error: string | null;
      email: string | null;
      companyName: string | null;
      planType: string | null;
      credits: number | null;
    } = { connected: false, error: "BREVO_API_KEY is not configured", email: null, companyName: null, planType: null, credits: null };

    if (apiKey) {
      try {
        const res = await fetch("https://api.brevo.com/v3/account", {
          headers: { "api-key": apiKey, accept: "application/json" },
        });
        if (!res.ok) {
          provider.error = `Brevo ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
        } else {
          const j = (await res.json()) as any;
          const marketing = (j?.plan ?? []).find((p: any) => p?.type) ?? null;
          provider = {
            connected: true,
            error: null,
            email: j?.email ?? null,
            companyName: j?.companyName ?? null,
            planType: marketing?.type ?? null,
            credits: typeof marketing?.credits === "number" ? marketing.credits : null,
          };
        }
      } catch (e) {
        provider.error = String((e as Error)?.message ?? e).slice(0, 200);
      }
    }

    const { data: autos } = await (context.supabase as any)
      .from("platform_email_automations")
      .select("key,label,enabled")
      .order("key");

    return {
      sender: PLATFORM_SENDER,
      provider,
      automations: (autos ?? []) as { key: string; label: string; enabled: boolean }[],
    };
  });
