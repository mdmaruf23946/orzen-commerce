// Platform-owner-only server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const ownerDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const [users, stores, active, suspended, payments] = await Promise.all([
      sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "user"),
      sb.from("stores").select("*", { count: "exact", head: true }),
      sb.from("stores").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("stores").select("*", { count: "exact", head: true }).eq("status", "suspended"),
      sb.from("payments").select("amount").eq("status", "paid"),
    ]);
    const revenue = (payments.data ?? []).reduce((a: number, b: any) => a + Number(b.amount), 0);
    return {
      users: users.count ?? 0,
      stores: stores.count ?? 0,
      active: active.count ?? 0,
      suspended: suspended.count ?? 0,
      revenue,
    };
  });

export const listAllStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("stores")
      .select("*, subscription_packages(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setStoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        packageId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: pkg } = await context.supabase
      .from("subscription_packages")
      .select("duration_days")
      .eq("id", data.packageId)
      .maybeSingle();
    if (!pkg) throw new Error("Package not found");
    const expires = new Date();
    expires.setDate(expires.getDate() + pkg.duration_days);
    const { error } = await context.supabase
      .from("stores")
      .update({ package_id: data.packageId, expires_at: expires.toISOString() })
      .eq("id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("subscription_packages")
      .select("*")
      .order("price", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        price: z.number().nonnegative(),
        duration_days: z.number().int().min(1).max(3650),
        product_limit: z.number().int().min(1).max(100000),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("subscription_packages").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await context.supabase
      .from("subscription_packages")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("subscription_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const amIOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    return { isOwner: !!data };
  });
