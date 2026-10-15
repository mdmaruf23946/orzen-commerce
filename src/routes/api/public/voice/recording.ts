// Streams an ePBX call recording. Access needs a short-lived signed URL issued to the
// store's own merchant (listCallRecordings); the store's ePBX token never reaches the browser.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Q = z.object({ c: z.string().uuid(), e: z.coerce.number().int(), k: z.string().min(16).max(80) });

async function handle(request: Request) {
  const url = new URL(request.url);
  const q = Q.safeParse({ c: url.searchParams.get("c"), e: url.searchParams.get("e"), k: url.searchParams.get("k") });
  if (!q.success) return new Response("Bad request", { status: 400 });
  const { verifyRecordingSig } = await import("@/lib/voice/queue.server");
  if (!verifyRecordingSig(q.data.c, q.data.e, q.data.k)) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: call } = await (supabaseAdmin as any).from("calls")
    .select("store_id,recording_ref").eq("id", q.data.c).maybeSingle();
  const ref: string | undefined = call?.recording_ref;
  if (ref?.startsWith("storage:")) {
    const path = ref.slice(8);
    if (!path.startsWith(`${call.store_id}/`)) return new Response("Not found", { status: 404 });
    const { data, error } = await supabaseAdmin.storage.from("call-recordings").download(path);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Content-Type": data.type || "audio/mpeg", "Cache-Control": "private, no-store" } });
  }
  if (!ref || !/^https:\/\//i.test(ref)) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = { "User-Agent": "ORZEN-Recording/1.0", Accept: "audio/*,*/*" };
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;
  const host = new URL(ref).hostname;
  if (host === "epbx.bd" || host.endsWith(".epbx.bd")) {
    const { data: conn } = await (supabaseAdmin as any).from("voice_provider_connections")
      .select("encrypted_token").eq("store_id", call.store_id).eq("provider", "epbx").maybeSingle();
    const { openToken } = await import("@/lib/voice/service.server");
    const creds = openToken(conn?.encrypted_token ?? null);
    if (creds?.api_token) headers["Authorization"] = `Bearer ${creds.api_token}`;
  }
  const up = await fetch(ref, { headers, redirect: "follow" }).catch(() => null);
  if (!up || (!up.ok && up.status !== 206)) return new Response("Recording unavailable", { status: 502 });
  const out = new Headers({ "Cache-Control": "private, no-store" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = up.headers.get(h); if (v) out.set(h, v);
  }
  if (!out.get("content-type")) out.set("content-type", "audio/mpeg");
  return new Response(up.body, { status: up.status, headers: out });
}

export const Route = createFileRoute("/api/public/voice/recording")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
