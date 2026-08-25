// Shared store-access layer for the Merchant Panel.
// Resolves whether the caller is the store owner or one of its employees,
// and enforces per-section permissions on the server.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allows, SECTION_BY_KEY, type PermissionMap } from "@/lib/panel-sections";

export type StaffInfo = {
  id: string;
  name: string;
  role: string;
  status: string;
  employee_code: string | null;
  must_change_password: boolean;
};

export type StoreAccess = {
  storeId: string | null;
  isOwner: boolean;
  /** The store owner's auth user id — used for all `owner_user_id` lookups. */
  ownerUserId: string;
  staff: StaffInfo | null;
  permissions: PermissionMap | null;
};

/** Owner => own store. Active employee => the store they belong to. */
export async function resolveStoreAccess(
  supabase: any,
  userId: string,
): Promise<StoreAccess> {
  const { data: own } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (own?.id) {
    return { storeId: own.id, isOwner: true, ownerUserId: userId, staff: null, permissions: null };
  }

  const { data: staff } = await supabase
    .from("store_staff")
    .select("id,name,role,status,permissions,store_id,employee_code,must_change_password")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!staff) {
    return { storeId: null, isOwner: false, ownerUserId: userId, staff: null, permissions: null };
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id,owner_user_id")
    .eq("id", staff.store_id)
    .maybeSingle();

  return {
    storeId: staff.store_id,
    isOwner: false,
    ownerUserId: store?.owner_user_id ?? userId,
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      employee_code: staff.employee_code ?? null,
      must_change_password: !!staff.must_change_password,
    },
    permissions: (staff.permissions ?? {}) as PermissionMap,
  };
}

export function assertSection(
  access: StoreAccess,
  section: string,
  level: "view" | "manage" = "view",
) {
  if (access.isOwner) return;
  if (!access.staff) throw new Error("No store access for this account");
  if (SECTION_BY_KEY[section]?.ownerOnly) throw new Error("This section is available to the store owner only");
  if (!allows(access.permissions, section, level)) {
    throw new Error("You don't have permission to use this section");
  }
}

/**
 * Middleware for Merchant Panel server functions.
 * Verifies section access, then rewrites `userId` to the *store owner's* id so
 * every existing `owner_user_id` lookup keeps working for employees too.
 */
export function storeAccess(section: string, level: "view" | "manage" = "view") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const access = await resolveStoreAccess(context.supabase, context.userId);
      if (!access.storeId) throw new Error("No store found for this account");
      assertSection(access, section, level);
      return next({
        context: {
          ...context,
          userId: access.ownerUserId,
          authUserId: context.userId,
          access,
        },
      });
    });
}

/** Owner-only Merchant Panel middleware (billing, settings, team, domains…). */
export const ownerOnlyAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const access = await resolveStoreAccess(context.supabase, context.userId);
    if (!access.isOwner) throw new Error("Only the store owner can do this");
    return next({ context: { ...context, access } });
  });

export function requireManage(context: any, section: string) {
  assertSection(context.access as StoreAccess, section, "manage");
}
