// Service Checkout configuration + intake fields.
// Owner-authenticated management plus the public reads the storefront needs.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  myStoreId,
  normalizeSettings,
  extOf,
  safeFileName,
  decodeBase64,
} from "@/lib/service-checkout.server";

const fieldTypes = [
  "short_text",
  "long_text",
  "dropdown",
  "radio",
  "checkbox",
  "date",
  "url",
  "number",
  "file",
  "files",
] as const;

/** Owner view: settings + all intake fields (including hidden ones). */
export const getServiceCheckoutConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return null;
    const [{ data: row }, { data: fields }] = await Promise.all([
      context.supabase.from("service_checkout_settings").select("*").eq("store_id", storeId).maybeSingle(),
      context.supabase
        .from("service_intake_fields")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true }),
    ]);
    return { settings: normalizeSettings(storeId, row), fields: (fields ?? []) as any[] };
  });

export const saveServiceCheckoutSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        customer_fields: z.record(z.string(), z.boolean()).optional(),
        payment_methods: z.array(z.string().max(120)).max(40).optional(),
        default_payment_method: z.string().max(120).nullable().optional(),
        payment_mode: z.enum(["full", "advance", "advance_required"]).optional(),
        min_advance_percent: z.number().int().min(1).max(100).optional(),
        terms: z.record(z.string(), z.boolean()).optional(),
        upload_max_mb: z.number().int().min(1).max(100).optional(),
        upload_max_files: z.number().int().min(0).max(20).optional(),
        upload_allowed_types: z.array(z.string().max(10)).max(40).optional(),
        auto_confirm: z.boolean().optional(),
        auto_invoice: z.boolean().optional(),
        notify_email: z.boolean().optional(),
        notify_sms: z.boolean().optional(),
        notify_whatsapp: z.boolean().optional(),
        thank_you_message: z.string().max(1000).nullable().optional(),
        staff_notes: z.string().max(2000).nullable().optional(),
        order_tags: z.array(z.string().max(40)).max(20).optional(),
        communication_enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { error } = await context.supabase
      .from("service_checkout_settings")
      .upsert({ store_id: storeId, ...data, updated_at: new Date().toISOString() } as any, {
        onConflict: "store_id",
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertServiceIntakeField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        label: z.string().trim().min(1).max(120),
        field_key: z.string().trim().min(1).max(60),
        field_type: z.enum(fieldTypes),
        options: z.array(z.string().max(80)).max(30).default([]),
        placeholder: z.string().max(160).nullable().optional(),
        help_text: z.string().max(300).nullable().optional(),
        is_required: z.boolean().default(false),
        is_visible: z.boolean().default(true),
        sort_order: z.number().int().min(0).max(999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const row = { ...data, store_id: storeId, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await context.supabase.from("service_intake_fields").update(row as any).eq("id", data.id).eq("store_id", storeId)
      : await context.supabase.from("service_intake_fields").insert(row as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteServiceIntakeField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const { error } = await context.supabase
      .from("service_intake_fields")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderServiceIntakeFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    await Promise.all(
      data.ids.map((id, i) =>
        context.supabase
          .from("service_intake_fields")
          .update({ sort_order: i } as any)
          .eq("id", id)
          .eq("store_id", storeId),
      ),
    );
    return { ok: true };
  });

/** Public: everything the storefront service checkout needs to render. */
export const getPublicServiceCheckoutConfig = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: fields }] = await Promise.all([
      sb.from("service_checkout_settings").select("*").eq("store_id", data.storeId).maybeSingle(),
      sb
        .from("service_intake_fields")
        .select("id,label,field_key,field_type,options,placeholder,help_text,is_required,is_visible,sort_order")
        .eq("store_id", data.storeId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true }),
    ]);
    return { settings: normalizeSettings(data.storeId, row), fields: (fields ?? []) as any[] };
  });

/**
 * Public upload used by the service checkout before the order exists.
 * Files are stored in a private bucket and linked to the order once it is
 * created (via the client-generated upload token).
 */
export const uploadServiceFile = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        uploadToken: z.string().min(8).max(64),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().max(120).optional(),
        base64: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: settingsRow } = await sb
      .from("service_checkout_settings")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();
    const s = normalizeSettings(data.storeId, settingsRow);

    const ext = extOf(data.fileName);
    if (s.upload_allowed_types.length && !s.upload_allowed_types.includes(ext)) {
      throw new Error(`.${ext || "file"} is not an accepted file type`);
    }
    const bytes = decodeBase64(data.base64);
    if (bytes.byteLength > s.upload_max_mb * 1024 * 1024) {
      throw new Error(`File is larger than ${s.upload_max_mb} MB`);
    }

    const { count } = await sb
      .from("service_order_files")
      .select("id", { count: "exact", head: true })
      .eq("upload_token", data.uploadToken);
    if ((count ?? 0) >= s.upload_max_files) {
      throw new Error(`You can upload at most ${s.upload_max_files} files`);
    }

    const name = safeFileName(data.fileName);
    const path = `${data.storeId}/${data.uploadToken}/${Date.now()}-${name}`;
    const { error: upErr } = await sb.storage.from("service-uploads").upload(path, bytes, {
      contentType: data.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);

    const { data: rec, error } = await sb
      .from("service_order_files")
      .insert({
        store_id: data.storeId,
        upload_token: data.uploadToken,
        path,
        file_name: name,
        mime_type: data.mimeType ?? null,
        size_bytes: bytes.byteLength,
      })
      .select("id,file_name,size_bytes")
      .single();
    if (error) throw new Error(error.message);
    return rec as any;
  });

export const removeServiceFile = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), uploadToken: z.string().min(8).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: row } = await sb
      .from("service_order_files")
      .select("id,path,order_id")
      .eq("id", data.id)
      .eq("upload_token", data.uploadToken)
      .maybeSingle();
    if (!row || (row as any).order_id) return { ok: false };
    await sb.storage.from("service-uploads").remove([(row as any).path]);
    await sb.from("service_order_files").delete().eq("id", data.id);
    return { ok: true };
  });

/** Owner: signed download links for the files attached to a service order. */
export const listServiceOrderFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return [];
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await sb
      .from("service_order_files")
      .select("id,path,file_name,size_bytes,mime_type")
      .eq("order_id", data.orderId)
      .eq("store_id", storeId);
    const out: any[] = [];
    for (const r of (rows ?? []) as any[]) {
      const { data: signed } = await sb.storage.from("service-uploads").createSignedUrl(r.path, 600);
      out.push({ ...r, url: signed?.signedUrl ?? null });
    }
    return out;
  });
