// Platform Owner Communication Center — Gmail-powered email + in-app notifications.
// Server functions for Gmail state, templates, and Gmail-transport campaigns.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function gwHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_MAIL_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY not configured");
  if (!key) throw new Error("Gmail is not connected. Connect Gmail in the Communication Center.");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  };
}

async function gmailProfile() {
  const res = await fetch(`${GATEWAY_URL}/users/me/profile`, { headers: gwHeaders() });
  const body = await res.text();
  if (!res.ok) throw new Error(`Gmail profile failed [${res.status}]: ${body.slice(0, 300)}`);
  return JSON.parse(body) as { emailAddress: string; messagesTotal?: number };
}

function b64url(s: string): string {
  const b = typeof Buffer !== "undefined"
    ? Buffer.from(s, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawEmail(opts: { from: string; to: string; subject: string; html: string; text?: string }) {
  const boundary = "orzen_" + Math.random().toString(36).slice(2);
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${b64url(opts.subject).replace(/-/g, "+").replace(/_/g, "/")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html,
    "",
    `--${boundary}--`,
    "",
  ];
  return b64url(lines.join("\r\n"));
}

async function sendGmail(opts: { from: string; to: string; subject: string; html: string }) {
  const raw = buildRawEmail(opts);
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: gwHeaders(),
    body: JSON.stringify({ raw }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Gmail send failed [${res.status}]: ${body.slice(0, 300)}`);
  return JSON.parse(body) as { id: string; threadId: string };
}

// ---- Gmail state ----

export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const hasKey = !!process.env.GOOGLE_MAIL_API_KEY;
    const { data: state } = await context.supabase
      .from("owner_gmail_state").select("*").eq("owner_id", context.userId).maybeSingle();
    if (!hasKey) return { connected: false, state, hasKey: false };

    try {
      const profile = await gmailProfile();
      // Refresh cached state
      await (context.supabase as any).from("owner_gmail_state").upsert({
        owner_id: context.userId,
        connected_email: profile.emailAddress,
        connected_at: state?.connected_at ?? new Date().toISOString(),
        last_tested_at: new Date().toISOString(),
        last_test_ok: true,
        last_test_error: null,
        updated_at: new Date().toISOString(),
      });
      return { connected: true, hasKey: true, email: profile.emailAddress, state };
    } catch (e: any) {
      return { connected: false, hasKey: true, error: e?.message ?? String(e), state };
    }
  });

export const sendGmailTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string }) => z.object({ to: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const profile = await gmailProfile();
    const { renderPlatformEmail } = await import("@/lib/brevo.server");
    const html = await renderPlatformEmail({
      title: "Gmail connection test সফল",
      bodyHtml: `<p style="margin:0">আপনার Gmail connected এবং email পাঠানোর জন্য প্রস্তুত।</p>`,
      kind: "platform",
      sanitizeBody: false,
    });
    try {
      const r = await sendGmail({ from: profile.emailAddress, to: data.to, subject: "ORZEN Gmail test", html });
      await (context.supabase as any).from("owner_gmail_state").upsert({
        owner_id: context.userId,
        connected_email: profile.emailAddress,
        last_tested_at: new Date().toISOString(),
        last_test_ok: true,
        last_test_error: null,
        updated_at: new Date().toISOString(),
      });
      return { ok: true, id: r.id };
    } catch (e: any) {
      await (context.supabase as any).from("owner_gmail_state").upsert({
        owner_id: context.userId,
        last_tested_at: new Date().toISOString(),
        last_test_ok: false,
        last_test_error: String(e?.message ?? e).slice(0, 500),
        updated_at: new Date().toISOString(),
      });
      throw e;
    }
  });

// ---- Templates ----

const TplSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(300),
  body_html: z.string().max(100000).default(""),
  notification_title: z.string().max(200).nullish(),
  notification_body: z.string().max(2000).nullish(),
});

export const listOwnerTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("owner_message_templates").select("*")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveOwnerTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TplSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase.from("owner_message_templates")
        .update({ ...data }).eq("id", data.id).eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await (context.supabase as any).from("owner_message_templates")
      .insert({ ...data, owner_id: context.userId }).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: r!.id as string };
  });

export const deleteOwnerTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("owner_message_templates")
      .delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Compose + send via Gmail ----

const ComposeSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(300),
  body_html: z.string().max(100000).default(""),
  notification_title: z.string().max(200).nullish(),
  notification_body: z.string().max(2000).nullish(),
  send_email: z.boolean().default(true),
  send_inapp: z.boolean().default(true),
  audience_kind: z.enum(["all", "stores", "status", "plan", "users"]).default("all"),
  audience_ids: z.array(z.string().uuid()).default([]),
  audience_filter: z.record(z.string(), z.any()).default(() => ({})),
});

type Recipient = { user_id: string; store_id: string | null; email: string | null; store_name?: string | null };

async function resolveRecipients(admin: any, audience: {
  audience_kind: string; audience_ids: string[]; audience_filter: any;
}): Promise<Recipient[]> {
  const { audience_kind: kind, audience_ids: ids, audience_filter: filter } = audience;
  let q = admin.from("stores").select("id,name,owner_user_id,subscription_status,package_id");
  if (kind === "stores" && ids.length) q = q.in("id", ids);
  if (kind === "status" && filter?.status) q = q.eq("subscription_status", filter.status);
  if (kind === "plan" && ids.length) q = q.in("package_id", ids);
  const { data: stores } = await q;
  const storeRows = (stores ?? []).filter((s: any) => s.owner_user_id);

  const userIds = new Set<string>(kind === "users" && ids.length ? ids : storeRows.map((s: any) => s.owner_user_id));
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const uid of userIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const store = storeRows.find((s: any) => s.owner_user_id === uid);
    let email: string | null = null;
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      email = (u?.user?.email as string) ?? null;
    } catch { /* ignore */ }
    out.push({ user_id: uid, store_id: store?.id ?? null, email, store_name: store?.name ?? null });
  }
  return out;
}

function resolveVars(text: string, vars: Record<string, string>): string {
  return (text ?? "").replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

function stripHtml(html: string): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

export const previewCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    audience_kind: z.enum(["all", "stores", "status", "plan", "users"]).default("all"),
    audience_ids: z.array(z.string().uuid()).default([]),
    audience_filter: z.record(z.string(), z.any()).default(() => ({})),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await resolveRecipients(supabaseAdmin, data);
    return { count: rows.length, preview: rows.slice(0, 25) };
  });

export const sendCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComposeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Gmail must be connected if we're sending email
    let fromEmail = "";
    if (data.send_email) {
      const profile = await gmailProfile();
      fromEmail = profile.emailAddress;
    }

    const recipients = await resolveRecipients(supabaseAdmin, data);

    // Persist campaign for history (reuse notification_campaigns)
    const channels: ("email" | "in_app")[] = [];
    if (data.send_email) channels.push("email");
    if (data.send_inapp) channels.push("in_app");

    let campaignId = data.campaign_id;
    const campaignRow = {
      title: data.notification_title || data.subject,
      body_html: data.body_html,
      notification_body: data.notification_body ?? stripHtml(data.body_html),
      subject: data.subject,
      sender_email: fromEmail || null,
      type: "communication",
      priority: "normal",
      channels,
      audience_kind: data.audience_kind,
      audience_ids: data.audience_ids,
      audience_filter: data.audience_filter,
      status: "sending",
      sent_at: new Date().toISOString(),
      created_by: context.userId,
    };
    if (campaignId) {
      await supabaseAdmin.from("notification_campaigns").update(campaignRow).eq("id", campaignId);
    } else {
      const { data: r, error } = await (supabaseAdmin as any)
        .from("notification_campaigns").insert(campaignRow).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      campaignId = r!.id as string;
    }

    let emailSent = 0, emailFailed = 0, inappCreated = 0;
    for (const r of recipients) {
      const vars: Record<string, string> = {
        store_name: r.store_name ?? "",
        owner_email: r.email ?? "",
        platform_name: "ORZEN",
      };
      const subject = resolveVars(data.subject, vars);
      const rawHtml = resolveVars(data.body_html, vars);
      const { renderPlatformEmail } = await import("@/lib/brevo.server");
      const html = await renderPlatformEmail({
        title: subject,
        bodyHtml: rawHtml,
        preheader: stripHtml(rawHtml).slice(0, 120),
        kind: "platform",
      });
      const inappTitle = resolveVars(data.notification_title || data.subject, vars);
      const inappBody = resolveVars(data.notification_body ?? stripHtml(data.body_html), vars);

      // recipient row
      const { data: existing } = await supabaseAdmin
        .from("notification_recipients").select("id,inapp_notification_id")
        .eq("campaign_id", campaignId).eq("user_id", r.user_id).maybeSingle();
      let recipientId = existing?.id as string | undefined;
      if (!recipientId) {
        const { data: ins } = await (supabaseAdmin as any).from("notification_recipients").insert({
          campaign_id: campaignId, store_id: r.store_id, user_id: r.user_id, email: r.email,
          variables: vars,
        }).select("id").maybeSingle();
        recipientId = ins?.id as string | undefined;
        if (!recipientId) continue;
      }

      if (data.send_inapp && !existing?.inapp_notification_id) {
        const { data: notif } = await (supabaseAdmin as any).from("admin_notifications").insert({
          store_id: r.store_id, user_id: r.user_id, campaign_id: campaignId,
          kind: "campaign", type: "communication", priority: "normal",
          title: inappTitle, body: inappBody,
          meta: { html },
        }).select("id").maybeSingle();
        if (notif?.id) {
          await supabaseAdmin.from("notification_recipients")
            .update({ inapp_notification_id: notif.id, inapp_status: "created" }).eq("id", recipientId);
          inappCreated++;
        }
      }

      if (data.send_email && r.email) {
        try {
          const sent = await sendGmail({ from: fromEmail, to: r.email, subject, html });
          await supabaseAdmin.from("notification_recipients").update({
            email_status: "sent", email_attempts: 1, sent_via: "gmail",
            email_sent_at: new Date().toISOString(),
            email_last_error: null,
          }).eq("id", recipientId);
          emailSent++;
          void sent;
        } catch (e: any) {
          await supabaseAdmin.from("notification_recipients").update({
            email_status: "failed", email_attempts: 1, sent_via: "gmail",
            email_last_error: String(e?.message ?? e).slice(0, 500),
          }).eq("id", recipientId);
          emailFailed++;
        }
      }
    }

    await supabaseAdmin.from("notification_campaigns").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      totals: {
        recipients: recipients.length,
        email_sent: emailSent, email_failed: emailFailed,
        inapp_created: inappCreated,
      },
    }).eq("id", campaignId);

    return { ok: true, campaign_id: campaignId, recipients: recipients.length, emailSent, emailFailed, inappCreated };
  });

export const retryFailedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipient_id: string }) => z.object({ recipient_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("notification_recipients")
      .select("id,email,campaign_id,variables").eq("id", data.recipient_id).maybeSingle();
    if (!r || !r.email) throw new Error("Recipient not found or no email");
    const { data: c } = await supabaseAdmin.from("notification_campaigns")
      .select("subject,body_html,sender_email").eq("id", r.campaign_id).maybeSingle();
    if (!c) throw new Error("Campaign not found");
    const profile = await gmailProfile();
    const vars = (r.variables as any) ?? {};
    const subject = ((c as any).subject ?? "").replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_: any, k: string) => vars[k] ?? "");
    const html = (c.body_html ?? "").replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_: any, k: string) => vars[k] ?? "");
    try {
      await sendGmail({ from: profile.emailAddress, to: r.email, subject, html });
      await supabaseAdmin.from("notification_recipients").update({
        email_status: "sent", email_attempts: 2, sent_via: "gmail",
        email_sent_at: new Date().toISOString(), email_last_error: null,
      }).eq("id", data.recipient_id);
      return { ok: true };
    } catch (e: any) {
      await supabaseAdmin.from("notification_recipients").update({
        email_status: "failed", email_attempts: 2, sent_via: "gmail",
        email_last_error: String(e?.message ?? e).slice(0, 500),
      }).eq("id", data.recipient_id);
      throw e;
    }
  });

// ---- History listing ----

export const listCommunicationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    let q = context.supabase.from("notification_campaigns")
      .select("id,title,subject,type,status,channels,sender_email,sent_at,completed_at,totals,created_at")
      .eq("type", "communication")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 300));
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCommunicationDetail = createServerFn({ method: "GET" })
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
      .select("id,store_id,user_id,email,email_status,email_last_error,email_attempts,email_sent_at,sent_via,inapp_status,read_at,created_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    return { campaign: c, recipients: recips ?? [] };
  });
