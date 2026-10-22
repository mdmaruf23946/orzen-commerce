// Shopper-facing Service order functions. An order id alone is never enough:
// every read of sensitive workflow data and every write action requires
// ownership proof (customer session token, or the phone/email on the order).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const proofShape = {
  storeId: z.string().uuid().optional(),
  token: z.string().min(16).max(128).optional(),
  contact: z.string().trim().max(160).optional(),
};

async function requireOwner(sb: any, orderId: string, proof: any) {
  const { ownsOrderById } = await import("@/lib/order-ownership.server");
  const ok = await ownsOrderById(sb, orderId, {
    storeId: proof.storeId,
    token: proof.token,
    contact: proof.contact,
  });
  if (!ok) throw new Error("Verify the phone or email used on this order to continue");
  return true;
}

export const getServiceOrder = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), ...proofShape }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { normalizeWorkflow } = await import("@/lib/service-workflow");
    const { loadServiceOrder } = await import("@/lib/service-order.server");
    const { ownsOrderById } = await import("@/lib/order-ownership.server");

    const order = await loadServiceOrder(sb, data.orderId);
    if (!order) return null;

    const verified = await ownsOrderById(sb, data.orderId, {
      storeId: data.storeId,
      token: data.token,
      contact: data.contact,
    });

    const { data: bundle, error } = await sb.rpc("get_public_service_order" as any, {
      _order_id: data.orderId,
    } as any);
    if (error) throw new Error(error.message);
    if (!bundle) return null;

    const b = bundle as any;
    const settings = normalizeWorkflow(order.store_id, b.settings);
    const progress: any[] = b.progress ?? [];
    const state = ((order.fulfillment_meta ?? {}) as any).service_state ?? {};
    const currentStage: string =
      state.stage ?? (progress.length ? progress[progress.length - 1].stage : "request_submitted");

    const usedRevisions = (b.revisions ?? []).length;
    const totalRevisions = Number(state.revisions_allowed ?? settings.default_revisions ?? 0);

    if (!verified) {
      // Unverified visitors only see the coarse progress timeline — no
      // deliverables, secrets, meeting links, contact details or reviews.
      return {
        verified: false,
        settings,
        currentStage,
        progress: progress.map((p: any) => ({ stage: p.stage, created_at: p.created_at })),
        meetings: [],
        assignment: null,
        updates: [],
        deliverables: [],
        revisions: [],
        review: null,
        files: [],
        revisionsRemaining: Math.max(0, totalRevisions - usedRevisions),
        revisionsAllowed: totalRevisions,
        cancelRequested: !!state.cancel_requested,
      };
    }

    return {
      verified: true,
      settings,
      currentStage,
      progress,
      meetings: b.meetings ?? [],
      assignment: b.assignment ?? null,
      updates: b.updates ?? [],
      deliverables: b.deliverables ?? [],
      revisions: b.revisions ?? [],
      review: b.review ?? null,
      files: b.files ?? [],
      revisionsRemaining: Math.max(0, totalRevisions - usedRevisions),
      revisionsAllowed: totalRevisions,
      cancelRequested: !!state.cancel_requested,
    };
  });

export const requestServiceRevision = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        text: z.string().trim().min(5).max(2000),
        ...proofShape,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { loadServiceOrder, workflowFor } = await import("@/lib/service-order.server");
    const order = await loadServiceOrder(sb, data.orderId);
    if (!order) throw new Error("Service order not found");
    await requireOwner(sb, data.orderId, data);

    const settings = await workflowFor(sb, order.store_id);
    const state = ((order.fulfillment_meta ?? {}) as any).service_state ?? {};
    const allowed = Number(state.revisions_allowed ?? settings.default_revisions ?? 0);
    const { count } = await sb
      .from("service_order_revisions")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    if ((count ?? 0) >= allowed) throw new Error("No revisions remaining for this order");

    const { error } = await sb.from("service_order_revisions").insert({
      order_id: order.id,
      store_id: order.store_id,
      request_text: data.text,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitServiceReview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().max(2000).optional(),
        recommend: z.boolean().optional(),
        screenshot: z.object({ name: z.string().max(200), data: z.string().max(8_000_000) }).optional(),
        ...proofShape,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { loadServiceOrder, safeName, decodeB64, DELIVERABLE_BUCKET } = await import(
      "@/lib/service-order.server"
    );
    const order = await loadServiceOrder(sb, data.orderId);
    if (!order) throw new Error("Service order not found");
    await requireOwner(sb, data.orderId, data);

    let screenshotPath: string | null = null;
    if (data.screenshot) {
      const bytes = decodeB64(data.screenshot.data) as Uint8Array;
      // Accept real images only (checked from the file's own bytes, not its name).
      const b = bytes;
      const kind =
        b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? { ext: "jpg", type: "image/jpeg" }
        : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? { ext: "png", type: "image/png" }
        : b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 ? { ext: "gif", type: "image/gif" }
        : b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 ? { ext: "webp", type: "image/webp" }
        : null;
      if (!kind) throw new Error("শুধু ছবি (JPG, PNG, WEBP, GIF) আপলোড করা যাবে।");
      if (bytes.length > 5 * 1024 * 1024) throw new Error("ছবির সাইজ ৫MB-এর কম হতে হবে।");
      const base = safeName(data.screenshot.name).replace(/\.[^.]*$/, "").slice(0, 80) || "screenshot";
      const path = `${order.store_id}/${order.id}/reviews/${Date.now()}-${base}.${kind.ext}`;
      const { error } = await sb.storage.from(DELIVERABLE_BUCKET).upload(path, bytes, {
        contentType: kind.type,
        upsert: false,
      });
      if (!error) screenshotPath = path;
    }

    const { error } = await sb.from("service_order_reviews").upsert(
      {
        order_id: order.id,
        store_id: order.store_id,
        rating: data.rating,
        review_text: data.text ?? null,
        recommend: data.recommend ?? true,
        screenshot_path: screenshotPath,
      },
      { onConflict: "order_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestServiceCancel = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().max(1000).optional(),
        ...proofShape,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { loadServiceOrder, workflowFor, patchServiceState } = await import(
      "@/lib/service-order.server"
    );
    const order = await loadServiceOrder(sb, data.orderId);
    if (!order) throw new Error("Service order not found");
    await requireOwner(sb, data.orderId, data);
    const settings = await workflowFor(sb, order.store_id);
    if (!settings.allow_cancel) throw new Error("Cancellation is not allowed for this service");

    await patchServiceState(sb, order, {
      cancel_requested: true,
      cancel_reason: data.reason ?? null,
      cancel_requested_at: new Date().toISOString(),
    });
    await sb.from("service_order_updates").insert({
      order_id: order.id,
      store_id: order.store_id,
      status_label: "Cancellation requested",
      note: data.reason ?? null,
    });
    return { ok: true };
  });

/** Short-lived signed link for a delivered file; enforces expiry + limit. */
export const requestServiceDeliverable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        deliverableId: z.string().uuid(),
        ...proofShape,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { DELIVERABLE_BUCKET } = await import("@/lib/service-order.server");
    await requireOwner(sb, data.orderId, data);

    const { data: row } = await sb
      .from("service_order_deliverables")
      .select("*")
      .eq("id", data.deliverableId)
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!row) throw new Error("File not found");
    const r = row as any;

    if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) {
      throw new Error("This download link has expired");
    }
    if (r.download_limit != null && r.download_count >= r.download_limit) {
      throw new Error("Download limit reached");
    }

    await sb
      .from("service_order_deliverables")
      .update({ download_count: (r.download_count ?? 0) + 1 })
      .eq("id", r.id);

    if (r.external_url) return { url: r.external_url as string };
    if (r.secret_value) return { secret: r.secret_value as string };
    if (!r.path) throw new Error("Nothing to download");

    const { data: signed, error } = await sb.storage
      .from(DELIVERABLE_BUCKET)
      .createSignedUrl(r.path, 300, { download: r.file_name ?? true });
    if (error || !signed) throw new Error(error?.message ?? "Could not create download link");
    return { url: signed.signedUrl as string };
  });
