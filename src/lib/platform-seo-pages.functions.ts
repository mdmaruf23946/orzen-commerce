// Winner Admin platform-page SEO: overrides live in platform_settings.settings.seo_pages.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PLATFORM_PAGES, effectiveSeo, type SeoOverrides } from "@/lib/platform-seo-pages";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("id").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Public: only the SEO overrides (no other platform settings leave the server). */
export const getPlatformSeoOverrides = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("platform_settings").select("settings").eq("id", 1).maybeSingle();
    return ((data?.settings as any)?.seo_pages ?? {}) as SeoOverrides;
  } catch {
    return {} as SeoOverrides;
  }
});

export const getPlatformSeoAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await (context.supabase as any).from("platform_settings").select("settings").eq("id", 1).maybeSingle();
    return ((data?.settings as any)?.seo_pages ?? {}) as SeoOverrides;
  });

const KeyEnum = z.enum(["home", "features", "pricing", "about", "contact"]);

export const savePlatformPageSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    key: KeyEnum,
    title: z.string().trim().max(120),
    description: z.string().trim().max(320),
    keywords: z.string().trim().max(400),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb: any = context.supabase;
    const { data: row } = await sb.from("platform_settings").select("settings").eq("id", 1).maybeSingle();
    const settings = { ...((row?.settings as any) ?? {}) };
    const pages = { ...(settings.seo_pages ?? {}) };
    pages[data.key] = { title: data.title, description: data.description, keywords: data.keywords, updated_at: new Date().toISOString() };
    settings.seo_pages = pages;
    const { error } = await sb.from("platform_settings").update({ settings }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generatePlatformSeoDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: KeyEnum, focus: z.string().trim().max(300).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: row } = await (context.supabase as any).from("platform_settings").select("settings").eq("id", 1).maybeSingle();
    const cur = effectiveSeo(data.key, (row?.settings as any)?.seo_pages);
    const page = PLATFORM_PAGES.find((p) => p.key === data.key)!;
    const { generateText, Output } = await import("ai");
    const { routedStructuredModel } = await import("@/lib/ai-provider.server");
    const model = await routedStructuredModel("google/gemini-2.5-flash");
    try {
      const { output } = await generateText({
        model,
        maxOutputTokens: 600,
        output: Output.object({
          schema: z.object({ title: z.string(), description: z.string(), keywords: z.array(z.string()) }),
        }),
        system:
          "You are an SEO copywriter for ORZEN (orzen.top), an AI eCommerce SaaS for Bangladeshi online sellers (store builder, AI sales agent, Messenger/WhatsApp automation, courier, landing pages, custom domain, analytics). Write in English. Title 50–60 characters and include 'ORZEN'. Description 140–160 characters with a clear benefit and call to action. 6–10 relevant search keywords. Never invent prices, numbers or claims.",
        prompt: `Page: ${page.label} (${page.path})\nCurrent title: ${cur.title}\nCurrent description: ${cur.description}\n${data.focus ? `Owner focus: ${data.focus}` : ""}`,
      });
      return {
        title: output.title.trim().slice(0, 120),
        description: output.description.trim().slice(0, 320),
        keywords: output.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12).join(", "),
      };
    } catch (e) {
      console.error("platform seo draft failed", e);
      throw new Error("AI ড্রাফট তৈরি করা যায়নি — একটু পরে আবার চেষ্টা করুন।");
    }
  });
