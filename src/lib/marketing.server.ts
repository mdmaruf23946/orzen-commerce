import { myStoreRow } from "@/lib/store-access";
// Server-only helpers for the Marketing settings module.
export async function loadOwnerMarketing(supabase: any, userId: string) {
  const data = await myStoreRow(supabase, userId, "id, slug, marketing", "marketing");
  return {
    store: data as { id: string; slug: string; marketing: any } | null,
    marketing: (data as any)?.marketing ?? {},
  };
}

/** Merge a patch into one namespace of stores.marketing without touching siblings. */
export async function saveMarketingNamespace(
  supabase: any,
  userId: string,
  namespace: string | null,
  patch: Record<string, unknown>,
) {
  const { marketing } = await loadOwnerMarketing(supabase, userId);
  const next = namespace
    ? { ...marketing, [namespace]: { ...(marketing?.[namespace] ?? {}), ...patch } }
    : { ...marketing, ...patch };
  const { error } = await supabase.from("stores").update({ marketing: next }).eq("owner_user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
