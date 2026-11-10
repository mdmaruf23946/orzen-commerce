// Winner Admin: real Google Search Console data for orzen.top (owner-only, never invented).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const TARGET = "https://orzen.top/";

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

export const getSearchConsoleSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await (context.supabase as any)
      .from("user_roles").select("id").eq("user_id", context.userId).eq("role", "owner").maybeSingle();
    if (!role) throw new Error("Forbidden");

    const lk = process.env.LOVABLE_API_KEY;
    const ck = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
    if (!lk || !ck) return { status: "not_connected" as const };
    const headers = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck };

    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    if (!sitesRes.ok) return { status: "error" as const, message: `Search Console [${sitesRes.status}]` };
    const { siteEntry = [] } = (await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel?: string }[] };
    const host = new URL(TARGET).hostname;
    const matches = siteEntry.filter((e) => e.permissionLevel !== "siteUnverifiedUser" && (
      e.siteUrl.startsWith("sc-domain:")
        ? host === e.siteUrl.slice(10) || host.endsWith("." + e.siteUrl.slice(10))
        : TARGET.startsWith(e.siteUrl)));
    if (!matches.length) return { status: "not_verified" as const };
    const siteUrl = (matches.find((m) => m.siteUrl === TARGET) ?? matches[0]).siteUrl;

    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - 27 * 86400000);
    const d = (x: Date) => x.toISOString().slice(0, 10);
    const q = async (body: Record<string, unknown>) => {
      const r = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: d(start), endDate: d(end), ...body }),
      });
      if (!r.ok) throw new Error(`Search Console [${r.status}]: ${await r.text()}`);
      return ((await r.json()) as { rows?: Row[] }).rows ?? [];
    };
    try {
      const [total, queries, pages] = await Promise.all([
        q({}), q({ dimensions: ["query"], rowLimit: 10 }), q({ dimensions: ["page"], rowLimit: 10 }),
      ]);
      let sitemaps: { path: string; errors: number; warnings: number; lastDownloaded?: string }[] = [];
      try {
        const sr = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers });
        if (sr.ok) sitemaps = (((await sr.json()) as any).sitemap ?? []).map((s: any) => ({
          path: s.path, errors: Number(s.errors ?? 0), warnings: Number(s.warnings ?? 0), lastDownloaded: s.lastDownloaded,
        }));
      } catch { /* optional */ }
      return {
        status: "ok" as const, siteUrl, startDate: d(start), endDate: d(end),
        totals: total[0] ?? null, queries, pages, sitemaps,
      };
    } catch (e: any) {
      return { status: "error" as const, message: String(e?.message ?? e).slice(0, 300) };
    }
  });
