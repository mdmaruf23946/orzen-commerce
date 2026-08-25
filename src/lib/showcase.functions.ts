// Landing page product-showcase mockups — public read + owner-only write.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShowcaseRow = {
  key: string;
  desktop_url: string | null;
  mobile_url: string | null;
};

export const SHOWCASE_KEYS = ["admin", "store", "owner", "ai", "analytics"] as const;
export type ShowcaseKey = (typeof SHOWCASE_KEYS)[number];

export const SHOWCASE_LABELS: Record<ShowcaseKey, string> = {
  admin: "Merchant Panel",
  store: "Customer Store",
  owner: "Owner Panel",
  ai: "AI Dashboard",
  analytics: "Analytics",
};

function publicClient() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertOwner(context: any) {
  const { data: role } = await (context.supabase as any)
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
}

export const getPublicShowcase = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await publicClient()
      .from("platform_showcase")
      .select("key, desktop_url, mobile_url")
      .limit(20);
    if (error || !data) return [] as ShowcaseRow[];
    return data as ShowcaseRow[];
  } catch {
    return [] as ShowcaseRow[];
  }
});

export const listShowcaseAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await (context.supabase as any)
      .from("platform_showcase")
      .select("key, desktop_url, mobile_url");
    if (error) throw new Error(error.message);
    return (data ?? []) as ShowcaseRow[];
  });

const saveSchema = z.object({
  rows: z
    .array(
      z.object({
        key: z.enum(SHOWCASE_KEYS),
        desktop_url: z.string().max(500).nullable(),
        mobile_url: z.string().max(500).nullable(),
      })
    )
    .max(10),
});

export const saveShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const payload = data.rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await (context.supabase as any)
      .from("platform_showcase")
      .upsert(payload, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
