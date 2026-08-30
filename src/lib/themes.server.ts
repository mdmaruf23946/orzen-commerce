import { myStoreRow } from "@/lib/store-access";
import { sanitizeOverrides } from "@/lib/theme/definition";

export async function requireThemeOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "owner",
  });
  if (error || !data) throw new Error("Forbidden");
}

export async function getThemeStore(supabase: any, userId: string) {
  const data = await myStoreRow(
    supabase,
    userId,
    "id, slug, theme_id, theme_overrides, theme_draft",
    "theme",
  );
  if (!data) throw new Error("No store found for this account");
  return data as any;
}

export async function getSafeThemeOverrides(
  supabase: any,
  themeId: string | null,
  overrides: Record<string, unknown>,
) {
  if (!themeId) return sanitizeOverrides(overrides, {});

  const { data, error } = await supabase
    .from("store_themes")
    .select("locked")
    .eq("id", themeId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const locks = ((data as any)?.locked as Record<string, unknown>) ?? {};
  return sanitizeOverrides(overrides, locks as any);
}