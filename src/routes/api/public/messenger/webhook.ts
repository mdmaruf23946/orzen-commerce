import { createFileRoute } from "@tanstack/react-router";
import {
  handleMessengerVerify,
  handleMessengerWebhook,
} from "@/lib/messenger-webhook.server";

export const Route = createFileRoute("/api/public/messenger/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMessengerVerify(request),
      POST: async ({ request }) => handleMessengerWebhook(request),
    },
  },
});
