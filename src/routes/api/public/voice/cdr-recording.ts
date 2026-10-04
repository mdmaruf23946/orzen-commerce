// Streams a recording from the provider call log. Needs a short-lived signed URL issued
// to the store's own merchant; the store's provider token never reaches the browser.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Q = z.object({
  s: z.string().uuid(),
  id: z.string().regex(/^[\w.\-]{1,80}$/),
  e: z.coerce.number().int(),
  k: z.string().min(16).max(80),
});

async function handle(request: Request) {
  const u = new URL(request.url);
  const q = Q.safeParse(Object.fromEntries(["s", "id", "e", "k"].map((k) => [k, u.searchParams.get(k)])));
  if (!q.success) return new Response("Bad request", { status: 400 });
  const { verifyCdrRecordingSig } = await import("@/lib/voice/queue.server");
  if (!verifyCdrRecordingSig(q.data.s, q.data.id, q.data.e, q.data.k)) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await (supabaseAdmin as any).from("voice_provider_connections")
    .select("encrypted_token,status").eq("store_id", q.data.s).eq("provider", "epbx").maybeSingle();
  const { openToken, getVoiceProvider } = await import("@/lib/voice/service.server");
  const creds = conn?.status === "connected" ? openToken(conn.encrypted_token ?? null) : null;
  if (!creds) return new Response("Not connected", { status: 404 });

  const headers: Record<string, string> = { Authorization: `Bearer ${creds.api_token}`, Accept: "audio/*,*/*" };
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;
  const up = await fetch(getVoiceProvider("epbx").recordingUrl(q.data.id), { headers }).catch(() => null);
  if (!up || (!up.ok && up.status !== 206)) return new Response("Recording unavailable", { status: 502 });
  const ct = up.headers.get("content-type") ?? "";
  if (ct.includes("json") || ct.includes("html")) return new Response("Recording unavailable", { status: 404 });
  const out = new Headers({ "Cache-Control": "private, no-store" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = up.headers.get(h); if (v) out.set(h, v);
  }
  if (!out.get("content-type")) out.set("content-type", "audio/wav");
  return new Response(up.body, { status: up.status, headers: out });
}

export const Route = createFileRoute("/api/public/voice/cdr-recording")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
