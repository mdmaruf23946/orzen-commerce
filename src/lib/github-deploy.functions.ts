// Owner-only: live deployment + GitHub connection status helpers.
import { createServerFn } from "@tanstack/react-start";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const LIVE_URL = "https://orzen.top/api/public/version";

export const liveDeploymentStatus = createServerFn({ method: "GET" })
  .middleware([(await import("@/integrations/supabase/auth-middleware")).requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        return { reachable: false, status: res.status, bootedAt: null, host: null, commit: null, checkedAt };
      }
      const body = (await res.json()) as any;
      return {
        reachable: true,
        status: res.status,
        bootedAt: body.bootedAt ?? null,
        host: body.host ?? null,
        commit: body.commit ?? null,
        checkedAt,
      };
    } catch (e: any) {
      return { reachable: false, status: 0, bootedAt: null, host: null, commit: null, checkedAt, error: String(e?.message ?? e) };
    }
  });
