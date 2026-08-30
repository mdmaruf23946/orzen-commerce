// Winner Admin owns the theme catalog; Store Admin only selects a theme and
// customises whitelisted options. Every store-side write is sanitized against
// the selected theme's locks server-side, so the UI gate cannot be bypassed.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  getSafeThemeOverrides,
  getThemeStore,
  requireThemeOwner,
} from "@/lib/themes.server";

// ---------------- SHARED READS ----------------

/** Published themes — visible to any signed-in store admin. */
export const listThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("store_themes")
      .select("id,name,slug,category,description,preview_url,status,sort_order,definition,locked,updated_at")
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Store admin state: selected theme, published overrides and unsaved draft. */
export const getMyThemeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await getThemeStore(context.supabase, context.userId);
    return {
      store_id: store.id,
      slug: store.slug as string,
      theme_id: store.theme_id ?? null,
      overrides: store.theme_overrides ?? {},
      draft: store.theme_draft ?? {},
    };
  });

// ---------------- STORE ADMIN (safe writes only) ----------------

export const selectStoreTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ themeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: theme } = await supabase
      .from("store_themes")
      .select("id,status")
      .eq("id", data.themeId)
      .maybeSingle();
    if (!theme || (theme as any).status !== "published") throw new Error("Theme unavailable");
    const { error } = await supabase
      .from("stores")
      .update({ theme_id: data.themeId, theme_overrides: {}, theme_draft: {} })
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveStoreThemeCustomization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        overrides: z.record(z.string(), z.unknown()),
        publish: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await getThemeStore(supabase, userId);
    const safe = await getSafeThemeOverrides(supabase, store.theme_id, data.overrides);
    const patch: any = data.publish
      ? { theme_overrides: safe, theme_draft: {} }
      : { theme_draft: safe };
    const { error } = await supabase.from("stores").update(patch).eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, overrides: safe };
  });

/** Reset customisations back to the theme's own design. */
export const resetStoreTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ full: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const patch: any = { theme_overrides: {}, theme_draft: {} };
    // "Restore Default Theme" also puts the store back on the default catalog theme.
    if (data.full) {
      const { data: def } = await context.supabase
        .from("store_themes")
        .select("id")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      patch.theme_id = (def as any)?.id ?? null;
    }
    const { error } = await context.supabase.from("stores").update(patch).eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- WINNER ADMIN ----------------

export const ownerListThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireThemeOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("store_themes")
      .select("id,name,slug,category,description,preview_url,status,sort_order,definition,locked,created_at,updated_at")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: stores } = await context.supabase.from("stores").select("theme_id");
    const usage: Record<string, number> = {};
    for (const s of (stores as any[]) ?? []) {
      if (s.theme_id) usage[s.theme_id] = (usage[s.theme_id] ?? 0) + 1;
    }
    return ((data as any[]) ?? []).map((t) => ({ ...t, used_by: usage[t.id] ?? 0 }));
  });

export const ownerSaveTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
        category: z.enum(["general", "fashion", "electronics", "food", "beauty", "sports", "services"]),
        description: z.string().trim().max(300).optional().nullable(),
        preview_url: z.string().trim().max(500).optional().nullable(),
        status: z.enum(["draft", "published", "hidden"]),
        sort_order: z.number().int().min(0).max(9999),
        definition: z.record(z.string(), z.unknown()),
        locked: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireThemeOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("store_themes").update(row as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: created, error } = await context.supabase
      .from("store_themes")
      .insert(row as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as any).id as string };
  });

export const ownerSetThemeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "hidden"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireThemeOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_themes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ownerDuplicateTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireThemeOwner(context.supabase, context.userId);
    const { data: src, error } = await context.supabase
      .from("store_themes")
      .select("name,slug,category,description,preview_url,sort_order,definition,locked")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw new Error(error?.message ?? "Theme not found");
    const s: any = src;
    const suffix = Date.now().toString(36).slice(-4);
    const { data: created, error: insErr } = await context.supabase
      .from("store_themes")
      .insert({
        ...s,
        name: `${s.name} Copy`,
        slug: `${s.slug}-${suffix}`.slice(0, 60),
        status: "draft",
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { ok: true, id: (created as any).id as string };
  });

export const ownerDeleteTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireThemeOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("store_themes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
