// Store staff management server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan, assertLimit } from "@/lib/plan-guard";

const STAFF_ROLES = ["manager", "agent", "viewer"] as const;
const STAFF_STATUS = ["invited", "active", "suspended"] as const;

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return { rows: [], limit: 0, used: 0 };
    const [{ data: rows }, { data: store }] = await Promise.all([
      context.supabase
        .from("store_staff")
        .select("id,name,email,phone,role,status,notes,invited_at,joined_at,created_at")
        .eq("store_id", sid)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("stores")
        .select("subscription_status, subscription_packages(staff_limit,is_trial)")
        .eq("id", sid)
        .maybeSingle(),
    ]);
    const plan = await resolveEffectivePlan(context.supabase, store as any);
    const limit = Number((plan as any)?.staff_limit ?? 0);

    return { rows: rows ?? [], limit, used: (rows ?? []).length };
  });

export const upsertStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional(),
        role: z.enum(STAFF_ROLES).default("agent"),
        status: z.enum(STAFF_STATUS).default("invited"),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "staff");
    const sid = await myStoreId(supabase, userId);
    if (!sid) throw new Error("No store");

    const fields = {
      name: data.name,
      email: data.email ? data.email : null,
      phone: data.phone || null,
      role: data.role,
      status: data.status,
      notes: data.notes || null,
      joined_at: data.status === "active" ? new Date().toISOString() : null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("store_staff")
        .update(fields)
        .eq("id", data.id)
        .eq("store_id", sid);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    await assertLimit(supabase, userId, "staff");
    const { data: created, error } = await supabase
      .from("store_staff")
      .insert({ ...fields, store_id: sid })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("store_staff")
      .delete()
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
