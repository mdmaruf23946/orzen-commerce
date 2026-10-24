// Store-owner Service order workflow management.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getServiceWorkflowSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { myStoreIdFor, workflowFor } = await import("@/lib/service-order.server");
    const storeId = await myStoreIdFor(context.supabase, context.userId);
    if (!storeId) return null;
    return workflowFor(context.supabase, storeId);
  });

export const saveServiceWorkflowSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled_stages: z.array(z.string().max(40)).max(20).optional(),
        default_revisions: z.number().int().min(0).max(50).optional(),
        allow_cancel: z.boolean().optional(),
        cancel_window_hours: z.number().int().min(0).max(720).optional(),
        response_time: z.string().max(120).nullable().optional(),
        support_channels: z.record(z.string(), z.boolean()).optional(),
        support_whatsapp: z.string().max(120).nullable().optional(),
        support_messenger: z.string().max(300).nullable().optional(),
        support_email: z.string().max(200).nullable().optional(),
        support_phone: z.string().max(60).nullable().optional(),
        allow_reviews: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { myStoreIdFor, workflowFor } = await import("@/lib/service-order.server");
    const storeId = await myStoreIdFor(context.supabase, context.userId);
    if (!storeId) throw new Error("No store found");
    const { error } = await context.supabase
      .from("service_workflow_settings")
      .upsert({ store_id: storeId, ...data }, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return workflowFor(context.supabase, storeId);
  });

/** Everything the admin drawer needs for one service order. */
export const getServiceOrderAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownedOrder, workflowFor } = await import("@/lib/service-order.server");
    const sb = context.supabase;
    const order = await ownedOrder(sb, context.userId, data.orderId);
    const [progress, meetings, assignment, updates, deliverables, revisions, review, files] =
      await Promise.all([
        sb.from("service_order_progress").select("*").eq("order_id", order.id).order("created_at"),
        sb.from("service_order_meetings").select("*").eq("order_id", order.id).order("starts_at"),
        sb.from("service_order_assignments").select("*").eq("order_id", order.id).maybeSingle(),
        sb
          .from("service_order_updates")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
        sb.from("service_order_deliverables").select("*").eq("order_id", order.id).order("created_at"),
        sb.from("service_order_revisions").select("*").eq("order_id", order.id).order("created_at"),
        sb.from("service_order_reviews").select("*").eq("order_id", order.id).maybeSingle(),
        sb.from("service_order_files").select("*").eq("order_id", order.id).order("created_at"),
      ]);
    const settings = await workflowFor(sb, order.store_id);
    const state = ((order.fulfillment_meta ?? {}) as any).service_state ?? {};
    return {
      settings,
      state,
      currentStage:
        state.stage ??
        ((progress.data ?? []).length
          ? (progress.data as any[])[(progress.data as any[]).length - 1].stage
          : "request_submitted"),
      service: ((order.fulfillment_meta ?? {}) as any).service ?? null,
      progress: progress.data ?? [],
      meetings: meetings.data ?? [],
      assignment: assignment.data ?? null,
      updates: updates.data ?? [],
      deliverables: deliverables.data ?? [],
      revisions: revisions.data ?? [],
      review: review.data ?? null,
      files: files.data ?? [],
    };
  });

export const setServiceStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        stage: z.string().max(40),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ownedOrder, patchServiceState } = await import("@/lib/service-order.server");
    const sb = context.supabase;
    const order = await ownedOrder(sb, context.userId, data.orderId);
    const { error } = await sb.from("service_order_progress").insert({
      order_id: order.id,
      store_id: order.store_id,
      stage: data.stage,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    await patchServiceState(sb, order, { stage: data.stage });
    return { ok: true };
  });

export const publishServiceUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        status_label: z.string().trim().min(2).max(120),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ownedOrder } = await import("@/lib/service-order.server");
    const order = await ownedOrder(context.supabase, context.userId, data.orderId);
    const { error } = await context.supabase.from("service_order_updates").insert({
      order_id: order.id,
      store_id: order.store_id,
      status_label: data.status_label,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveServiceMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orderId: z.string().uuid(),
        starts_at: z.string().min(4),
        duration_minutes: z.number().int().min(5).max(600).nullable().optional(),
        timezone: z.string().max(80).nullable().optional(),
        platform: z.string().max(40),
        meeting_link: z.string().max(500).nullable().optional(),
        office_address: z.string().max(500).nullable().optional(),
        passcode: z.string().max(80).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
        status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ownedOrder } = await import("@/lib/service-order.server");
    const sb = context.supabase;
    const order = await ownedOrder(sb, context.userId, data.orderId);
    const { orderId, id, ...rest } = data;
    const row = { ...rest, order_id: order.id, store_id: order.store_id };
    const q = id
      ? sb.from("service_order_meetings").update(row).eq("id", id).eq("store_id", order.store_id)
      : sb.from("service_order_meetings").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignServiceStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        role: z.enum(["staff", "freelancer", "agent"]),
        avatar_url: z.string().max(500).nullable().optional(),
        whatsapp: z.string().max(60).nullable().optional(),
        messenger: z.string().max(300).nullable().optional(),
        email: z.string().max(200).nullable().optional(),
        phone: z.string().max(60).nullable().optional(),
        response_time: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ownedOrder } = await import("@/lib/service-order.server");
    const sb = context.supabase;
    const order = await ownedOrder(sb, context.userId, data.orderId);
    const { orderId, ...rest } = data;
    const { error } = await sb
      .from("service_order_assignments")
      .upsert(
        { order_id: order.id, store_id: order.store_id, last_reply_at: new Date().toISOString(), ...rest },
        { onConflict: "order_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addServiceDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        kind: z.string().max(30),
        title: z.string().trim().min(1).max(200),
        file: z
          .object({ name: z.string().max(200), data: z.string().max(30_000_000), type: z.string().max(120).optional() })
          .optional(),
        external_url: z.string().max(600).nullable().optional(),
        secret_value: z.string().max(2000).nullable().optional(),
        expires_at: z.string().nullable().optional(),
        download_limit: z.number().int().min(1).max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ownedOrder, safeName, decodeB64, DELIVERABLE_BUCKET } = await import(
      "@/lib/service-order.server"
    );
    const sb = context.supabase;
    const order = await ownedOrder(sb, context.userId, data.orderId);

    let path: string | null = null;
    let fileName: string | null = null;
    let size: number | null = null;
    if (data.file) {
      const bytes = decodeB64(data.file.data);
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("ফাইল সর্বোচ্চ 20MB হতে পারে।");
      const ALLOWED: Record<string, string> = {
        pdf: "application/pdf", zip: "application/zip", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mp3: "audio/mpeg", txt: "text/plain",
        csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", epub: "application/epub+zip",
      };
      const ext = (data.file.name.split(".").pop() ?? "").toLowerCase();
      const contentType = ALLOWED[ext];
      if (!contentType) throw new Error("এই ধরনের ফাইল অনুমোদিত নয়।");
      fileName = safeName(data.file.name);
      size = bytes.byteLength;
      path = `${order.store_id}/${order.id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await sb.storage
        .from(DELIVERABLE_BUCKET)
        .upload(path, bytes, { contentType });
      if (upErr) throw new Error(upErr.message);
    }

    const { error } = await sb.from("service_order_deliverables").insert({
      order_id: order.id,
      store_id: order.store_id,
      kind: data.kind,
      title: data.title,
      path,
      file_name: fileName,
      mime_type: data.file?.type ?? null,
      size_bytes: size,
      external_url: data.external_url ?? null,
      secret_value: data.secret_value ?? null,
      expires_at: data.expires_at ?? null,
      download_limit: data.download_limit ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteServiceDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("service_order_deliverables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondServiceRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["requested", "in_progress", "delivered", "rejected"]),
        admin_response: z.string().trim().max(2000).optional(),
        deadline_at: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("service_order_revisions")
      .update({ ...rest, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantServiceRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), allowed: z.number().int().min(0).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownedOrder, patchServiceState } = await import("@/lib/service-order.server");
    const order = await ownedOrder(context.supabase, context.userId, data.orderId);
    await patchServiceState(context.supabase, order, { revisions_allowed: data.allowed });
    return { ok: true };
  });
