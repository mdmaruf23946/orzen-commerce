import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVoiceConnection } from "@/lib/voice.functions";
import type { ProviderConnectionMap } from "@/lib/call-sms-providers";

/** Which Call & SMS providers are connected for this store. Add a line per
 *  provider; sidebar menus appear/disappear from this map automatically. */
export function useProviderConnections(enabled = true) {
  const fn = useServerFn(getVoiceConnection);
  const voice = useQuery({ queryKey: ["voice", "connection"], queryFn: () => fn(), enabled, staleTime: 30_000 });
  const connected: ProviderConnectionMap = {
    epbx: (voice.data?.connection as any)?.status === "connected",
  };
  return { connected, isLoading: voice.isLoading };
}
