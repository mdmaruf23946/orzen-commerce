// Platform-wide branding management (Winner Admin controlled).
// Public read is exposed via the `get_platform_branding` RPC so SSR / anonymous
// consumers can render the correct logo without an authenticated session.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export type BrandingAsset = {
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  size?: number | null;
} | null;

export type PlatformBranding = {
  assets: Record<string, BrandingAsset>;
  combo: {
    mode?: "logo" | "wordmark" | "both";
    layout?: "left" | "top" | "centered";
    align?: "start" | "center" | "end";
    gap?: number;
    logoSize?: number;
    wordmarkSize?: number;
  };
  placements: Record<
    string,
    {
      source?: "global" | "custom";
      mode?: "logo" | "wordmark" | "both";
      layout?: "left" | "top" | "centered";
      align?: "start" | "center" | "end";
      visible?: boolean;
      logo?: BrandingAsset;
      wordmark?: BrandingAsset;
      sizes?: { desktop?: number; tablet?: number; mobile?: number };
      lightAsset?: BrandingAsset;
      darkAsset?: BrandingAsset;
    }
  >;
  published_at: string | null;
  updated_at: string | null;
};

const EMPTY: PlatformBranding = {
  assets: {},
  combo: {
    mode: "both",
    layout: "left",
    align: "start",
    gap: 8,
    logoSize: 32,
    wordmarkSize: 24,
  },
  placements: {},
  published_at: null,
  updated_at: null,
};

// ------- PUBLIC READ (no auth) -------
export const getPlatformBranding = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await (supabase as any).rpc("get_platform_branding");
  if (error) return EMPTY;
  return { ...EMPTY, ...(data ?? {}) } as PlatformBranding;
});

// ------- OWNER MUTATIONS -------
const AssetShape = z
  .object({
    url: z.string().min(1),
    width: z.number().int().nullish(),
    height: z.number().int().nullish(),
    mime: z.string().max(80).nullish(),
    size: z.number().int().nullish(),
  })
  .nullable();

const UpdateSchema = z.object({
  assets: z.record(z.string(), AssetShape).optional(),
  combo: z
    .object({
      mode: z.enum(["logo", "wordmark", "both"]).optional(),
      layout: z.enum(["left", "top", "centered"]).optional(),
      align: z.enum(["start", "center", "end"]).optional(),
      gap: z.number().int().min(0).max(96).optional(),
      logoSize: z.number().int().min(8).max(256).optional(),
      wordmarkSize: z.number().int().min(8).max(256).optional(),
    })
    .optional(),
  placements: z.record(z.string(), z.any()).optional(),
});

export const updatePlatformBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;

    const { data: cur } = await sb
      .from("platform_branding")
      .select("assets, combo, placements")
      .eq("id", "global")
      .maybeSingle();

    const merged = {
      assets: { ...(cur?.assets ?? {}), ...(data.assets ?? {}) },
      combo: { ...(cur?.combo ?? {}), ...(data.combo ?? {}) },
      placements: { ...(cur?.placements ?? {}), ...(data.placements ?? {}) },
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from("platform_branding")
      .upsert({ id: "global", ...merged });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishPlatformBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { error } = await sb
      .from("platform_branding")
      .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetPlatformBrandingPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: cur } = await sb
      .from("platform_branding")
      .select("placements")
      .eq("id", "global")
      .maybeSingle();
    const placements = { ...(cur?.placements ?? {}) };
    delete placements[data.key];
    const { error } = await sb
      .from("platform_branding")
      .update({ placements, updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
