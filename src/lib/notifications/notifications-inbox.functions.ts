// Store Admin inbox for platform notifications.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: "all" | "unread"; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    // Store owner's admin notifications (per-store scope, existing pattern),
    // plus campaign-scoped notifications targeted at this user_id.
    const { data: stores } = await context.supabase
      .from("stores").select("id").eq("owner_user_id", context.userId);
    const storeIds = (stores ?? []).map((s: any) => s.id);

    let q = context.supabase
      .from("admin_notifications")
      .select("id,title,body,kind,type,priority,action_label,action_type,action_target,meta,read_at,created_at,campaign_id,store_id,user_id")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 200));

    if (storeIds.length > 0) {
      q = q.or(`store_id.in.(${storeIds.join(",")}),user_id.eq.${context.userId}`);
    } else {
      q = q.eq("user_id", context.userId);
    }
    if (data.status === "unread") q = q.is("read_at", null);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    await context.supabase.from("admin_notifications").update({ read_at: now }).eq("id", data.id);
    // Update recipient row if this belongs to a campaign for this user
    await context.supabase.from("notification_recipients").update({ read_at: now, inapp_status: "read" })
      .eq("inapp_notification_id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    const { data: stores } = await context.supabase
      .from("stores").select("id").eq("owner_user_id", context.userId);
    const storeIds = (stores ?? []).map((s: any) => s.id);
    if (storeIds.length) {
      await context.supabase.from("admin_notifications")
        .update({ read_at: now }).is("read_at", null).in("store_id", storeIds);
    }
    await context.supabase.from("admin_notifications")
      .update({ read_at: now }).is("read_at", null).eq("user_id", context.userId);
    await context.supabase.from("notification_recipients")
      .update({ read_at: now, inapp_status: "read" }).is("read_at", null).eq("user_id", context.userId);
    return { ok: true };
  });
