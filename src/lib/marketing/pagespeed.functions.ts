// Owner-only Google PageSpeed Insights lookup (real data, no placeholders).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const runPageSpeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(500), strategy: z.enum(["mobile", "desktop"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: role } = await (context.supabase as any).from("user_roles").select("id").eq("user_id", context.userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Forbidden");
    const qs = new URLSearchParams({ url: data.url, strategy: data.strategy });
    for (const c of ["performance", "seo", "accessibility", "best-practices"]) qs.append("category", c);
    const key = process.env.PAGESPEED_API_KEY;
    if (key) qs.set("key", key);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`);
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) throw new Error("Google-এর ফ্রি সীমা শেষ — কিছুক্ষণ পরে আবার চেষ্টা করুন।");
      throw new Error(j?.error?.message ?? `PageSpeed error ${res.status}`);
    }
    const cats = j.lighthouseResult?.categories ?? {};
    const audits = j.lighthouseResult?.audits ?? {};
    const pct = (c: any) => (c?.score == null ? null : Math.round(c.score * 100));
    return {
      performance: pct(cats.performance),
      seo: pct(cats.seo),
      accessibility: pct(cats.accessibility),
      bestPractices: pct(cats["best-practices"]),
      lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
      fcp: audits["first-contentful-paint"]?.displayValue ?? null,
      cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
      tbt: audits["total-blocking-time"]?.displayValue ?? null,
    };
  });
