import { fetchTemplate, seedStoreFromTemplate, templateStoreFields } from "@/lib/store-template";

type ClaimsLike = {
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type EnsuredStore = {
  store: any;
  isEmployee: boolean;
  created: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function defaultThemeId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("store_themes")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: first } = await supabase
    .from("store_themes")
    .select("id")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (first?.id as string) ?? null;
}

/**
 * Register <slug>.<root> on the hosting network so the storefront answers
 * immediately. Failures never block store creation, but they are logged and
 * retried later (Domains page self-heal), never silently dropped.
 */
export async function attachStoreSubdomain(supabase: any, slug: string) {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    const root = (((data?.settings as any) ?? {}).root_domain ?? "orzen.top").toLowerCase();
    const host = `${slug}.${root}`;
    const { ensureSubdomainAttached } = await import("@/lib/cloudflare-pages.server");
    const res = await ensureSubdomainAttached(host);
    if (!res.ok) {
      console.error(
        `[subdomain] could not attach ${host}: ${res.reason ?? "error"} ${res.error ?? ""}`,
      );
    }
    return res;
  } catch (e) {
    console.error(`[subdomain] attach threw for ${slug}: ${(e as Error).message}`);
    return { ok: false, hostname: slug, reason: "error" as const, error: (e as Error).message };
  }
}

/**
 * Resolve the signed-in account's store and create a missing merchant store.
 * Ownership always comes from the authenticated user id supplied by auth
 * middleware; callers cannot provide a different owner id.
 */
export async function ensureStoreForAccount(
  supabase: any,
  userId: string,
  claims: ClaimsLike,
  columns = "*",
): Promise<EnsuredStore> {
  const ownerLookup = () =>
    supabase.from("stores").select(columns).eq("owner_user_id", userId).maybeSingle();

  const { data: owned, error: ownerError } = await ownerLookup();
  if (ownerError) throw new Error(ownerError.message);
  if (owned) return { store: owned, isEmployee: false, created: false };

  const { data: staff, error: staffError } = await supabase
    .from("store_staff")
    .select("store_id,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (staffError) throw new Error(staffError.message);
  if (staff) {
    if (staff.status !== "active")
      throw new Error("Your employee account is not active. Contact the store owner.");
    const { data: staffStore, error } = await supabase
      .from("stores")
      .select(columns)
      .eq("id", staff.store_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staffStore) throw new Error("Your store could not be found. Contact the store owner.");
    return { store: staffStore, isEmployee: true, created: false };
  }

  const metadata = claims.user_metadata ?? {};
  const email = claims.email ?? "store";
  const requestedSlug = slugify(String(metadata.store_slug ?? ""));
  const base = requestedSlug || slugify(email.split("@")[0] ?? "") || "store";
  const storeName =
    String(metadata.store_name ?? "").trim() ||
    `${base.charAt(0).toUpperCase() + base.slice(1)}'s Store`;
  const template = await fetchTemplate(supabase);
  const fields = templateStoreFields(template);
  const themeId = await defaultThemeId(supabase);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        owner_user_id: userId,
        slug,
        name: storeName,
        status: "active",
        ...fields,
        theme_id: themeId,
      })
      .select(columns)
      .single();

    if (!error && created) {
      if (template && created.id) {
        try {
          await seedStoreFromTemplate(supabase, created.id, template);
        } catch {
          // The store is usable even if optional starter content cannot be seeded.
        }
      }
      await attachStoreSubdomain(supabase, slug);
      return { store: created, isEmployee: false, created: true };
    }
    if (error?.code !== "23505") throw new Error(error?.message ?? "Store could not be created");

    // A concurrent request may have created this owner's store first.
    const { data: concurrent, error: concurrentError } = await ownerLookup();
    if (concurrentError) throw new Error(concurrentError.message);
    if (concurrent) return { store: concurrent, isEmployee: false, created: false };
  }

  throw new Error("A unique store address could not be created. Please try again.");
}
