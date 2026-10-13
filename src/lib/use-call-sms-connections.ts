import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVoiceConnection } from "@/lib/voice.functions";
import { getOrzenCallSettings } from "@/lib/orzen-call.functions";
import type { ProviderConnectionMap } from "@/lib/call-sms-providers";

/** Which Call & SMS providers are connected for this store. Add a line per
 *  provider; sidebar menus appear/disappear from this map automatically. */
export function useProviderConnections(enabled = true) {
  const fn = useServerFn(getVoiceConnection);
  const voice = useQuery({ queryKey: ["voice", "connection"], queryFn: () => fn(), enabled, staleTime: 30_000 });
  const ocFn = useServerFn(getOrzenCallSettings);
  const oc = useQuery({ queryKey: ["orzen-call", "settings"], queryFn: () => ocFn(), enabled, staleTime: 30_000 });
  const connected: ProviderConnectionMap = {
    epbx: (voice.data?.connection as any)?.status === "connected",
    "orzen-call": !!oc.data?.connected,
  };
  return { connected, isLoading: voice.isLoading };
}
