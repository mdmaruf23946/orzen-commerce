// Registry for Payment Gateway Apps. A gateway gets its own sidebar menu ONLY
// while it is connected (status Connected/Verified); otherwise it appears only
// on the hub page. Each gateway's data and settings stay isolated.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Plug, Settings, type LucideIcon } from "lucide-react";
import { listStorePaymentGateways } from "@/lib/store-payments.functions";
import { supabase } from "@/integrations/supabase/client";

export const PAYMENT_HUB_PATH = "/admin/payment-gateways/apps";
export const PAYMENT_OVERVIEW_PATH = "/admin/payment-gateways/overview";

export type PaymentSectionKey = "overview" | "integration" | "settings";
export const PAYMENT_SECTIONS: { key: PaymentSectionKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "integration", label: "Integration", icon: Plug },
  { key: "settings", label: "Settings", icon: Settings },
];

type Conn = { enabled: boolean; status: string; last_test_result: unknown } | null;

export function gatewayStatus(c: Conn): "connected" | "verified" | "error" | "disabled" | "none" {
  if (!c) return "none";
  if (!c.enabled) return "disabled";
  if (c.status === "error") return "error";
  if (c.status === "connected") return (c.last_test_result as any)?.ok === true ? "verified" : "connected";
  return "none";
}

export function isGatewayConnected(c: Conn) {
  const s = gatewayStatus(c);
  return s === "connected" || s === "verified";
}

export function useMyStoreId() {
  const { data } = useQuery({
    queryKey: ["my-store-id"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("stores").select("id").eq("owner_user_id", u.user.id).maybeSingle();
      return data?.id ?? null;
    },
  });
  return data ?? null;
}

export function usePaymentGateways() {
  const storeId = useMyStoreId();
  const list = useServerFn(listStorePaymentGateways);
  const q = useQuery({
    enabled: !!storeId,
    queryKey: ["storePaymentGateways", storeId],
    queryFn: () => list({ data: { storeId: storeId! } }),
    staleTime: 60_000,
  });
  return { storeId, gateways: q.data ?? [], isLoading: q.isLoading || !storeId };
}

/** Connected gateways only, for the sidebar. */
export function usePaymentGatewayConnections() {
  const { gateways } = usePaymentGateways();
  return gateways
    .filter((g) => isGatewayConnected(g.connection as Conn))
    .map((g) => ({ id: g.provider_id, label: g.label }));
}
