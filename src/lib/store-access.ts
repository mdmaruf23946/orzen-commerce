// Shared store-access layer for the Merchant Panel.
// Resolves whether the caller is the store owner, an employee, or a delegated
// member of the store selected in the panel, and enforces section permissions.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allows, SECTION_BY_KEY, type PermissionMap } from "@/lib/panel-sections";
import { ensureStoreForAccount } from "@/lib/store-bootstrap";
import { requestedStoreId } from "@/lib/request-store";
export { requestedStoreId };

export type StaffInfo = {
  id: string;
  name: string;
  role: string;
  status: string;
  employee_code: string | null;
  must_change_password: boolean;
  access_type: "employee" | "delegated";
};

export type StoreAccess = {
  storeId: string | null;
  isOwner: boolean;
  /** The store owner's auth user id — used for all `owner_user_id` lookups. */
  ownerUserId: string;
  staff: StaffInfo | null;
  permissions: PermissionMap | null;
  /** The caller's own store id (when they own one), even while working elsewhere. */
  ownStoreId?: string | null;
};

const STAFF_COLS =
  "id,name,role,status,permissions,store_id,employee_code,must_change_password,access_type,expires_at";

function notExpired(row: any) {
  return !row?.expires_at || new Date(row.expires_at).getTime() > Date.now();
}

/** Active, unexpired membership of `userId` in `storeId` (employee or delegated). */
export async function activeMembership(supabase: any, userId: string, storeId: string) {
  const { data } = await supabase
    .from("store_staff")
    .select(STAFF_COLS)
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();
  return data && notExpired(data) ? data : null;
}

async function staffAccess(supabase: any, userId: string, staff: any, ownStoreId: string | null): Promise<StoreAccess> {
  const { data: store } = await supabase
    .from("stores")
    .select("id,owner_user_id")
    .eq("id", staff.store_id)
    .maybeSingle();
  return {
    storeId: staff.store_id,
    isOwner: false,
    ownerUserId: store?.owner_user_id ?? userId,
    ownStoreId,
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      employee_code: staff.employee_code ?? null,
      must_change_password: !!staff.must_change_password,
      access_type: staff.access_type === "delegated" ? "delegated" : "employee",
    },
    permissions: (staff.permissions ?? {}) as PermissionMap,
  };
}

/** Owner => own store. Member => the selected (or first) store they belong to. */
export async function resolveStoreAccess(
  supabase: any,
  userId: string,
  claims?: Record<string, unknown>,
): Promise<StoreAccess> {
  const { data: own } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  const ownId: string | null = own?.id ?? null;

  const wanted = requestedStoreId();
  if (wanted && wanted !== ownId) {
    const m = await activeMembership(supabase, userId, wanted);
    if (m) return staffAccess(supabase, userId, m, ownId);
  }

  if (ownId) {
    return { storeId: ownId, isOwner: true, ownerUserId: userId, ownStoreId: ownId, staff: null, permissions: null };
  }

  const { data: rows } = await supabase
    .from("store_staff")
    .select(STAFF_COLS)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("access_type", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(5);
  const staff = (rows ?? []).find(notExpired);

  if (!staff) {
    if (claims) {
      const ensured = await ensureStoreForAccount(supabase, userId, claims, "id,owner_user_id");
      return {
        storeId: ensured.store.id,
        isOwner: !ensured.isEmployee,
        ownerUserId: ensured.store.owner_user_id ?? userId,
        ownStoreId: ensured.isEmployee ? null : ensured.store.id,
        staff: null,
        permissions: null,
      };
    }
    return { storeId: null, isOwner: false, ownerUserId: userId, staff: null, permissions: null };
  }

  return staffAccess(supabase, userId, staff, null);
}

export function assertSection(
  access: StoreAccess,
  section: string,
  level: "view" | "manage" = "view",
) {
  if (access.isOwner) return;
  if (!access.staff) throw new Error("No store access for this account");
  if (SECTION_BY_KEY[section]?.ownerOnly)
    throw new Error("This section is available to the store owner only");
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
      const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
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
    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    if (!access.isOwner) throw new Error("Only the store owner can do this");
    return next({ context: { ...context, access } });
  });

export function requireManage(context: any, section: string) {
  assertSection(context.access as StoreAccess, section, "manage");
}

/**
 * Resolve the store the caller works in: the store they own, or — for an
 * active employee — their employer's store. Returns null when neither exists.
 */
export async function resolveStoreRef(
  supabase: any,
  userId: string,
): Promise<{ id: string } | null> {
  const access = await resolveStoreAccess(supabase, userId);
  return access.storeId ? { id: access.storeId } : null;
}

/**
 * Same as resolveStoreRef but selects the requested columns of that store.
 * When `section` is given, an employee must have at least view access to it.
 */
export async function myStoreRow(
  supabase: any,
  userId: string,
  columns = "id",
  section?: string,
): Promise<any | null> {
  if (section) {
    const access = await resolveStoreAccess(supabase, userId);
    if (!access.storeId) return null;
    assertSection(access, section, "view");
    if (columns === "id") return { id: access.storeId };
    const { data: row } = await supabase
      .from("stores")
      .select(columns)
      .eq("id", access.storeId)
      .maybeSingle();
    return row ?? null;
  }
  const ref = await resolveStoreRef(supabase, userId);
  if (!ref) return null;
  if (columns === "id") return ref;
  const { data } = await supabase.from("stores").select(columns).eq("id", ref.id).maybeSingle();
  return data ?? null;
}
