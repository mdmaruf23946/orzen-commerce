// ePBX call-status callback. Each call gets its own signed URL (?c=<call id>&k=<HMAC>),
// so only ePBX (which received that URL) can update that one call.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Q = z.object({ c: z.string().uuid(), k: z.string().min(16).max(80) });

async function handle(request: Request) {
  const url = new URL(request.url);
  const q = Q.safeParse({ c: url.searchParams.get("c"), k: url.searchParams.get("k") });
  if (!q.success) return new Response("Bad request", { status: 400 });
  const { verifyWebhookSig, handleEpbxWebhook } = await import("@/lib/voice/queue.server");
  if (!verifyWebhookSig(q.data.c, q.data.k)) return new Response("Unauthorized", { status: 401 });

  let body: any = {};
  if (request.method === "POST") {
    const text = await request.text();
    try { body = JSON.parse(text); } catch {
      body = Object.fromEntries(new URLSearchParams(text));
    }
  } else {
    body = Object.fromEntries(url.searchParams);
  }
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 20000) {
    return new Response("Bad request", { status: 400 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const r = await handleEpbxWebhook(supabaseAdmin, q.data.c, body);
    return Response.json({ ok: r.ok });
  } catch (e) {
    console.error("[epbx-webhook]", (e as Error).message);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/voice/epbx")({
  server: { handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) } },
});
