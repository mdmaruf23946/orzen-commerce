import { useVoiceConnection } from "@/components/admin/calls/VoicePanels";
import type { ProviderConnectionMap } from "@/lib/call-sms-providers";

/** Which Call & SMS providers are connected for this store. Add a line per
 *  provider; sidebar menus appear/disappear from this map automatically. */
export function useProviderConnections() {
  const voice = useVoiceConnection();
  const connected: ProviderConnectionMap = {
    epbx: (voice.data?.connection as any)?.status === "connected",
  };
  return { connected, isLoading: voice.isLoading };
}
