// Best-effort activity logging for the Merchant Panel.
import type { StoreAccess } from "@/lib/store-access";

export type ActivityInput = {
  section: string;
  action: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

/** Never throws — logging must not block the action it describes. */
export async function logActivity(
  supabase: any,
  access: StoreAccess | undefined | null,
  input: ActivityInput,
) {
  try {
    if (!access?.storeId) return;
    await supabase.from("staff_activity_log").insert({
      store_id: access.storeId,
      actor_user_id: access.isOwner ? access.ownerUserId : null,
      actor_staff_id: access.staff?.id ?? null,
      actor_name: access.isOwner ? "Merchant (owner)" : (access.staff?.name ?? "Employee"),
      actor_kind: access.isOwner ? "owner" : "employee",
      section: input.section,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      meta: input.meta ?? {},
    });
  } catch {
    /* ignore */
  }
}
