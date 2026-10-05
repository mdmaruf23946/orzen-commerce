// Serves a merchant's uploaded call-script MP3 to ePBX. Each URL is HMAC-signed
// per file path, so only links we generated can be fetched.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Q = z.object({
  p: z.string().regex(/^[0-9a-f-]{36}\/[\w-]+\.mp3$/i),
  k: z.string().min(16).max(64),
});

async function handle(request: Request) {
  const url = new URL(request.url);
  const q = Q.safeParse({ p: url.searchParams.get("p"), k: url.searchParams.get("k") });
  if (!q.success) return new Response("Bad request", { status: 400 });
  const { verifyAudioSig } = await import("@/lib/voice/queue.server");
  if (!verifyAudioSig(q.data.p, q.data.k)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("voice-audio").download(q.data.p);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600" },
  });
}

export const Route = createFileRoute("/api/public/voice/audio")({
  server: { handlers: { GET: ({ request }) => handle(request) } },
});
