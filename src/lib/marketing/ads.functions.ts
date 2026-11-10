// Owner-only Advertisement Management server functions.
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

export const getAdSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ad_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        id: "global",
        enabled: false,
        provider: "adsterra",
        show_on_plans: ["free"],
        updated_at: null,
      }
    );
  });

export const updateAdSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        provider: z.string().min(1).max(40),
        show_on_plans: z.array(z.string().min(1).max(30)).min(0).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ad_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ad_slots")
      .select("*")
      .order("slot_key", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const SlotInput = z.object({
  id: z.string().uuid().optional(),
  slot_key: z.string().min(2).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  provider: z.string().min(1).max(40).default("adsterra"),
  code: z.string().max(20000).default(""),
  format: z.enum(["banner_728x90", "banner_320x50", "banner_300x250", "native", "responsive"]),
  is_active: z.boolean().default(true),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
});

export const upsertAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SlotInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ad_slots")
      .upsert(data, { onConflict: "slot_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ad_slots")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("ad_slots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const [{ data: settings }, { data: slots }] = await Promise.all([
      context.supabase.from("ad_settings").select("*").eq("id", "global").maybeSingle(),
      context.supabase.from("ad_slots").select("id, is_active, updated_at"),
    ]);
    const all = slots ?? [];
    const active = all.filter((s: any) => s.is_active);
    const lastUpdated = all.reduce<string | null>(
      (acc, s: any) => (!acc || s.updated_at > acc ? s.updated_at : acc),
      settings?.updated_at ?? null,
    );
    return {
      totalSlots: all.length,
      activeSlots: active.length,
      enabledGlobal: !!settings?.enabled,
      lastUpdated,
    };
  });
