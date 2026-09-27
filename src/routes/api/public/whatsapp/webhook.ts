import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppVerify, handleWhatsAppWebhook } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: ({ request }) => handleWhatsAppVerify(request),
      POST: ({ request }) => handleWhatsAppWebhook(request),
    },
  },
});
