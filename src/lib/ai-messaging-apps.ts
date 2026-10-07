// Registry of AI Messaging apps. An app gets its own sidebar menu ONLY while it
// is connected; otherwise it shows only on the "AI Messaging Apps" hub.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMessengerIntegration } from "@/lib/ai.functions";
import { getWhatsappIntegration } from "@/lib/whatsapp.functions";

export type AiMessagingApp = {
  id: "messenger" | "whatsapp";
  name: string;
  description: string;
  inboxPath: string;
  integrationPath: string;
};

export const AI_MESSAGING_HUB_PATH = "/admin/ai-messaging/apps";

export const AI_MESSAGING_APPS: AiMessagingApp[] = [
  {
    id: "messenger",
    name: "Messenger AI",
    description: "AI replies to your Facebook Page messages, takes orders and answers customers 24/7.",
    inboxPath: "/admin/messenger-inbox",
    integrationPath: "/admin/messenger",
  },
  {
    id: "whatsapp",
    name: "WhatsApp AI",
    description: "AI replies on your WhatsApp Business number, takes orders and answers customers 24/7.",
    inboxPath: "/admin/whatsapp-inbox",
    integrationPath: "/admin/whatsapp",
  },
];

export type AiMessagingConnectionMap = Record<string, boolean>;

export function useAiMessagingConnections(enabled = true) {
  const m = useServerFn(getMessengerIntegration);
  const w = useServerFn(getWhatsappIntegration);
  const mq = useQuery({ queryKey: ["ai-messaging", "messenger"], queryFn: () => m(), enabled, staleTime: 30_000, retry: false });
  const wq = useQuery({ queryKey: ["ai-messaging", "whatsapp"], queryFn: () => w(), enabled, staleTime: 30_000, retry: false });
  const connected: AiMessagingConnectionMap = {
    messenger: !!(mq.data as any)?.connected,
    whatsapp: !!(wq.data as any)?.connected,
  };
  return { connected, isLoading: mq.isLoading || wq.isLoading };
}
