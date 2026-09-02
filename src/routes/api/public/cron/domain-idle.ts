// Cron endpoint: idle landing-page domain sweep.
//
// 15 days without any activity  -> warn the merchant (idle_warned_at)
// 30 days without any activity  -> release every host of that page from
//                                  Cloudflare. Rows are kept, so the merchant
//                                  can press Reconnect at any time.
//
// Call daily with Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

const WARN_DAYS = 15;
const RELEASE_DAYS = 30;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export const Route = createFileRoute("/api/public/cron/domain-idle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env["CRON_SECRET"];
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { releaseLandingSubdomain, releaseLandingCustomDomains } = await import(
          "@/lib/domain-lifecycle.server"
        );

        // 1. Warn pages idle for 15+ days (not yet warned, hosts still live).
        const { data: toWarn } = await supabaseAdmin
          .from("landing_pages")
          .select("id,store_id,title")
          .lt("last_activity_at", daysAgo(WARN_DAYS))
          .is("idle_warned_at", null)
          .is("hosts_released_at", null)
          .limit(200);

        for (const page of (toWarn ?? []) as any[]) {
          await supabaseAdmin
            .from("landing_pages")
            .update({ idle_warned_at: new Date().toISOString() } as never)
            .eq("id", page.id);
        }

        // 2. Release hosts of pages idle for 30+ days.
        const { data: toRelease } = await supabaseAdmin
          .from("landing_pages")
          .select("id")
          .lt("last_activity_at", daysAgo(RELEASE_DAYS))
          .is("hosts_released_at", null)
          .limit(100);

        let released = 0;
        for (const page of (toRelease ?? []) as any[]) {
          try {
            const a = await releaseLandingSubdomain(supabaseAdmin, page.id, "idle");
            const b = await releaseLandingCustomDomains(supabaseAdmin, page.id, "idle");
            released += a + b;
            await supabaseAdmin
              .from("landing_pages")
              .update({ hosts_released_at: new Date().toISOString() } as never)
              .eq("id", page.id);
          } catch {
            // Try again on the next run.
          }
        }

        return Response.json({
          ok: true,
          warned: (toWarn ?? []).length,
          pagesReleased: (toRelease ?? []).length,
          hostsReleased: released,
        });
      },
    },
  },
});
