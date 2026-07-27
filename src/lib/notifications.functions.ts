// Platform-owner Notification Center server functions.
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

const CampaignSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body_html: z.string().max(50000).default(""),
  type: z.string().default("general"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  channels: z.array(z.enum(["email", "in_app"])).min(1),
  action_label: z.string().max(80).nullish(),
  action_type: z.enum(["internal", "external", "none"]).default("none"),
  action_target: z.string().max(500).nullish(),
  audience_kind: z.enum(["all", "stores", "users", "plan", "status"]).default("all"),
  audience_ids: z.array(z.string().uuid()).default([]),
  audience_filter: z.record(z.any()).default({}),
  scheduled_at: z.string().nullish(),
  scheduled_tz: z.string().nullish(),
});

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; q?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    let q = context.supabase
      .from("notification_campaigns")
      .select("id,title,type,priority,channels,status,scheduled_at,sent_at,completed_at,totals,created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 200));
    if (data.status) q = q.eq("status", data.status);
    if (data.q) q = q.ilike("title", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: c, error } = await context.supabase
      .from("notification_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Not found");
    const { data: recips } = await context.supabase
      .from("notification_recipients")
      .select("id,store_id,user_id,email,email_status,email_last_error,inapp_status,read_at,created_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(500);
    return { campaign: c, recipients: recips ?? [] };
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CampaignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { data: r, error } = await context.supabase
        .from("notification_campaigns").update(payload).eq("id", data.id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      return { id: r?.id ?? data.id };
    }
    const { data: r, error } = await context.supabase
      .from("notification_campaigns").insert({ ...payload, status: "draft" }).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: r!.id as string };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("notification_campaigns").delete().eq("id", data.id).in("status", ["draft", "cancelled", "failed"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("notification_campaigns").update({ status: "cancelled" }).eq("id", data.id).in("status", ["scheduled", "draft"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AudienceSchema = z.object({
  audience_kind: z.enum(["all", "stores", "users", "plan", "status"]),
  audience_ids: z.array(z.string().uuid()).default([]),
  audience_filter: z.record(z.any()).default({}),
});

export const resolveAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AudienceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await resolveRecipientsInternal(supabaseAdmin, data);
    return { count: rows.length, preview: rows.slice(0, 20) };
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("notification_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (cErr || !campaign) throw new Error(cErr?.message ?? "Not found");
    if (!["draft", "scheduled", "failed"].includes(campaign.status)) {
      throw new Error(`Cannot send from status: ${campaign.status}`);
    }

    await supabaseAdmin.from("notification_campaigns")
      .update({ status: "sending", sent_at: new Date().toISOString() }).eq("id", data.id);

    const audience = {
      audience_kind: campaign.audience_kind,
      audience_ids: campaign.audience_ids ?? [],
      audience_filter: campaign.audience_filter ?? {},
    };
    const recipients = await resolveRecipientsInternal(supabaseAdmin, audience);

    let emailSent = 0, emailFailed = 0, inappCreated = 0;
    const channels: string[] = campaign.channels ?? [];
    const wantInApp = channels.includes("in_app");
    const wantEmail = channels.includes("email");

    for (const r of recipients) {
      // Idempotent recipient row
      const { data: existing } = await supabaseAdmin
        .from("notification_recipients").select("id,inapp_notification_id")
        .eq("campaign_id", data.id).eq("user_id", r.user_id).maybeSingle();

      let recipientId = existing?.id as string | undefined;
      if (!recipientId) {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from("notification_recipients").insert({
            campaign_id: data.id, store_id: r.store_id, user_id: r.user_id, email: r.email,
          }).select("id").maybeSingle();
        if (insErr) continue;
        recipientId = ins!.id as string;
      }

      // In-app notification
      if (wantInApp && !existing?.inapp_notification_id) {
        const { data: notif } = await supabaseAdmin.from("admin_notifications").insert({
          store_id: r.store_id, user_id: r.user_id, campaign_id: data.id,
          kind: "campaign", type: campaign.type, priority: campaign.priority,
          title: campaign.title, body: stripHtml(campaign.body_html),
          action_label: campaign.action_label, action_type: campaign.action_type, action_target: campaign.action_target,
          meta: { html: campaign.body_html },
        }).select("id").maybeSingle();
        if (notif?.id) {
          await supabaseAdmin.from("notification_recipients")
            .update({ inapp_notification_id: notif.id, inapp_status: "created" }).eq("id", recipientId);
          inappCreated++;
        }
      }

      // Email
      if (wantEmail && r.email) {
        try {
          const { error: qErr } = await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              template_name: "platform-notification",
              recipient_email: r.email,
              idempotency_key: `notif-${data.id}-${r.user_id}`,
              template_data: {
                title: campaign.title,
                body_html: campaign.body_html,
                type: campaign.type,
                priority: campaign.priority,
                action_label: campaign.action_label,
                action_url: buildActionUrl(campaign.action_type, campaign.action_target),
              },
            },
          });
          if (qErr) throw new Error(qErr.message);
          await supabaseAdmin.from("notification_recipients").update({
            email_status: "sent", email_attempts: 1,
          }).eq("id", recipientId);
          emailSent++;
        } catch (e: any) {
          await supabaseAdmin.from("notification_recipients").update({
            email_status: "failed", email_last_error: String(e?.message ?? e).slice(0, 500), email_attempts: 1,
          }).eq("id", recipientId);
          emailFailed++;
        }
      }
    }

    await supabaseAdmin.from("notification_campaigns").update({
      status: "completed", completed_at: new Date().toISOString(),
      totals: { recipients: recipients.length, email_sent: emailSent, email_failed: emailFailed, inapp_created: inappCreated },
    }).eq("id", data.id);

    return { ok: true, recipients: recipients.length, emailSent, emailFailed, inappCreated };
  });

export const scheduleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; at: string; tz?: string }) =>
    z.object({ id: z.string().uuid(), at: z.string(), tz: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("notification_campaigns").update({
      status: "scheduled", scheduled_at: data.at, scheduled_tz: data.tz ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Templates ----
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("notification_templates")
      .select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const TemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.string().default("general"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  title: z.string().min(1).max(200),
  body_html: z.string().max(50000).default(""),
  action_label: z.string().max(80).nullish(),
  action_type: z.enum(["internal", "external", "none"]).default("none"),
  action_target: z.string().max(500).nullish(),
});

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase.from("notification_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await context.supabase.from("notification_templates").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: r!.id as string };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("notification_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- helpers ----
function stripHtml(html: string): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

function buildActionUrl(type: string | null | undefined, target: string | null | undefined): string | null {
  if (!type || type === "none" || !target) return null;
  const base = process.env.VITE_APP_URL || "https://orzen-commerce.lovable.app";
  if (type === "external") {
    try { const u = new URL(target); return u.protocol === "https:" ? u.toString() : null; }
    catch { return null; }
  }
  if (type === "internal") {
    const path = target.startsWith("/") ? target : `/${target}`;
    return `${base}${path}`;
  }
  return null;
}

type Recipient = { user_id: string; store_id: string | null; email: string | null };

async function resolveRecipientsInternal(admin: any, audience: any): Promise<Recipient[]> {
  const kind = audience.audience_kind as string;
  const ids: string[] = audience.audience_ids ?? [];
  const filter = audience.audience_filter ?? {};

  // Base: all store owners
  let storesQ = admin.from("stores").select("id,owner_user_id,subscription_status,package_id");
  if (kind === "stores" && ids.length) storesQ = storesQ.in("id", ids);
  if (kind === "status" && filter.status) storesQ = storesQ.eq("subscription_status", filter.status);
  if (kind === "plan" && ids.length) storesQ = storesQ.in("package_id", ids);
  const { data: stores } = await storesQ;
  const storeRows = (stores ?? []).filter((s: any) => s.owner_user_id);

  let userIds = new Set<string>(storeRows.map((s: any) => s.owner_user_id));
  if (kind === "users" && ids.length) {
    userIds = new Set(ids);
  }

  // Fetch emails via auth admin
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  for (const uid of userIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const store = storeRows.find((s: any) => s.owner_user_id === uid);
    let email: string | null = null;
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      email = (u?.user?.email as string) ?? null;
    } catch { /* ignore */ }
    recipients.push({ user_id: uid, store_id: store?.id ?? null, email });
  }
  return recipients;
}
