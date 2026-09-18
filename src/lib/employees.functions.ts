// Employee (staff) management + RBAC server functions for the Merchant Panel.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan, assertLimit, resolveEffectivePlan } from "@/lib/plan-guard";
import { ownerOnlyAccess, resolveStoreAccess, assertSection } from "@/lib/store-access";
import { logActivity } from "@/lib/activity-log";
import { GRANTABLE_SECTIONS, presetPermissions } from "@/lib/panel-sections";

const LEVEL = z.enum(["none", "view", "manage"]);
const ROLE = z.enum([
  "manager",
  "order_agent",
  "support_agent",
  "inventory_staff",
  "viewer",
  "custom",
]);
const STATUS = z.enum(["invited", "active", "suspended"]);

function cleanPermissions(input: Record<string, string> | undefined): Record<string, string> {
  const allowed = new Set(GRANTABLE_SECTIONS.map((s) => s.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (allowed.has(k) && (v === "view" || v === "manage")) out[k] = v;
  }
  return out;
}

async function nextEmployeeCode(supabase: any, storeId: string) {
  const { count } = await supabase
    .from("store_staff")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  return `EMP-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Who am I in this store? Drives the sidebar, gates and the employee home. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    return {
      storeId: access.storeId,
      isOwner: access.isOwner,
      isEmployee: !!access.staff,
      staff: access.staff,
      permissions: access.permissions,
    };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([ownerOnlyAccess])
  .handler(async ({ context }) => {
    const sid = (context.access as any).storeId as string;
    const [{ data: rows }, { data: store }] = await Promise.all([
      context.supabase
        .from("store_staff")
        .select(
          "id,name,email,phone,role,status,notes,permissions,employee_code,user_id,last_login_at,must_change_password,created_at",
        )
        .eq("store_id", sid)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("stores")
        .select("subscription_status, subscription_packages(staff_limit,is_trial)")
        .eq("id", sid)
        .maybeSingle(),
    ]);
    const plan = await resolveEffectivePlan(context.supabase, store as any);
    return {
      rows: rows ?? [],
      limit: Number((plan as any)?.staff_limit ?? 0),
      used: (rows ?? []).length,
    };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([ownerOnlyAccess])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(160),
        phone: z.string().trim().max(40).optional(),
        password: z.string().min(8).max(72),
        role: ROLE.default("custom"),
        status: STATUS.default("active"),
        notes: z.string().trim().max(500).optional(),
        permissions: z.record(z.string(), LEVEL).optional(),
        mustChangePassword: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const access = context.access as any;
    const sid = access.storeId as string;
    const { assertEmailVerified } = await import("@/lib/require-verified.server");
    await assertEmailVerified(userId);
    await assertPlan(supabase, userId, "staff");
    await assertLimit(supabase, userId, "staff");

    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create (or reuse) the login account for this employee.
    let authUserId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { employee_of_store: sid, full_name: data.name },
    });
    if (created.error) {
      throw new Error(
        created.error.message.toLowerCase().includes("already")
          ? "This email already has a platform account. Use a different email."
          : created.error.message,
      );
    }
    authUserId = created.data.user?.id ?? null;

    const permissions = cleanPermissions(
      data.role === "custom"
        ? (data.permissions as any)
        : { ...presetPermissions(data.role), ...(data.permissions ?? {}) },
    );

    const { data: row, error } = await supabase
      .from("store_staff")
      .insert({
        store_id: sid,
        user_id: authUserId,
        name: data.name,
        email,
        phone: data.phone || null,
        role: data.role,
        status: data.status,
        notes: data.notes || null,
        permissions,
        must_change_password: data.mustChangePassword,
        employee_code: await nextEmployeeCode(supabase, sid),
        created_by: userId,
        joined_at: data.status === "active" ? new Date().toISOString() : null,
      })
      .select("id,employee_code")
      .single();

    if (error) {
      if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      throw new Error(error.message);
    }

    await logActivity(supabase, access, {
      section: "employees",
      action: "employee.create",
      summary: `Added employee ${data.name} (${row.employee_code})`,
      entityType: "employee",
      entityId: row.id,
    });
    return row;
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([ownerOnlyAccess])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().max(40).optional(),
        role: ROLE,
        status: STATUS,
        notes: z.string().trim().max(500).optional(),
        permissions: z.record(z.string(), LEVEL).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const access = context.access as any;
    const sid = access.storeId as string;

    const { error } = await supabase
      .from("store_staff")
      .update({
        name: data.name,
        phone: data.phone || null,
        role: data.role,
        status: data.status,
        notes: data.notes || null,
        permissions: cleanPermissions(data.permissions as any),
        joined_at: data.status === "active" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);

    await logActivity(supabase, access, {
      section: "employees",
      action: "employee.update",
      summary: `Updated employee ${data.name} (${data.status})`,
      entityType: "employee",
      entityId: data.id,
    });
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([ownerOnlyAccess])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().min(8).max(72),
        mustChangePassword: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const access = context.access as any;
    const { data: row } = await supabase
      .from("store_staff")
      .select("id,name,user_id")
      .eq("id", data.id)
      .eq("store_id", access.storeId)
      .maybeSingle();
    if (!row?.user_id) throw new Error("This employee has no login account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.password,
    });
    if (res.error) throw new Error(res.error.message);

    await supabase
      .from("store_staff")
      .update({ must_change_password: data.mustChangePassword })
      .eq("id", data.id)
      .eq("store_id", access.storeId);

    await logActivity(supabase, access, {
      section: "employees",
      action: "employee.password_reset",
      summary: `Reset password for ${row.name}`,
      entityType: "employee",
      entityId: data.id,
    });
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([ownerOnlyAccess])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const access = context.access as any;
    const { data: row } = await supabase
      .from("store_staff")
      .select("id,name,user_id")
      .eq("id", data.id)
      .eq("store_id", access.storeId)
      .maybeSingle();
    if (!row) throw new Error("Employee not found");

    const { error } = await supabase
      .from("store_staff")
      .delete()
      .eq("id", data.id)
      .eq("store_id", access.storeId);
    if (error) throw new Error(error.message);

    if (row.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.deleteUser(row.user_id).catch(() => {});
    }

    await logActivity(supabase, access, {
      section: "employees",
      action: "employee.delete",
      summary: `Removed employee ${row.name}`,
      entityType: "employee",
      entityId: data.id,
    });
    return { ok: true };
  });

/**
 * Which login system does this signed-in account belong to?
 * `employee` = has a staff record (any status). `merchant` = owns a store.
 */
export const myAccountKind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase
      .from("store_staff")
      .select("id,status")
      .eq("user_id", userId)
      .maybeSingle();
    if (staff) {
      return { kind: "employee" as const, active: staff.status === "active" };
    }
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    return { kind: store ? ("merchant" as const) : ("none" as const), active: true };
  });

/** Employee signs in: verify they belong to a store and stamp last login. */
export const employeeSessionInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    if (!access.staff) {
      const { data: inactive } = await context.supabase
        .from("store_staff")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      return {
        ok: false as const,
        reason: inactive ? ("inactive_employee" as const) : ("not_employee" as const),
      };
    }

    await context.supabase
      .from("store_staff")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", access.staff.id);
    await logActivity(context.supabase, access, {
      section: "general",
      action: "employee.login",
      summary: `${access.staff.name} signed in`,
    });
    return { ok: true as const, staff: access.staff, permissions: access.permissions };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    const { error } = await context.supabase.auth.updateUser({ password: data.password });
    if (error) throw new Error(error.message);
    if (access.staff) {
      await context.supabase
        .from("store_staff")
        .update({ must_change_password: false })
        .eq("id", access.staff.id);
    }
    return { ok: true };
  });

export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        actor: z.string().optional(),
        section: z.string().optional(),
        days: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    if (!access.storeId) return { rows: [] };
    assertSection(access, "activity", "view");

    let q = context.supabase
      .from("staff_activity_log")
      .select(
        "id,actor_name,actor_kind,actor_staff_id,section,action,summary,entity_type,entity_id,created_at",
      )
      .eq("store_id", access.storeId)
      .gte("created_at", new Date(Date.now() - data.days * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.actor) q = q.eq("actor_staff_id", data.actor);
    if (data.section) q = q.eq("section", data.section);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
