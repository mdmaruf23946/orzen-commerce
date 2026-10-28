import { useTabVisible } from "@/lib/use-tab-visible";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminBadgeCounts,
  markFeatureSeen,
  markAllNotificationsRead,
  markConversationRead,
  type BadgeCounts,
  type BadgeFeature,
} from "@/lib/badge-counts.functions";
import { supabase } from "@/integrations/supabase/client";

const EMPTY: BadgeCounts = {
  orders: 0, returns: 0, customers: 0, messenger: 0, handoff: 0,
  low_stock: 0, notifications: 0, payments: 0, payment_gateway: 0,
  delivery: 0, landing_pages: 0, duplicate_protection: 0, ai_recommendations: 0,
};

export const badgeCountsKey = ["admin-badge-counts"] as const;

export function useBadgeCounts() {
  const fetchFn = useServerFn(getAdminBadgeCounts);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: badgeCountsKey,
    queryFn: () => fetchFn(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const storeId = query.data?.store_id ?? null;

  const visible = useTabVisible();
  useEffect(() => {
    if (!storeId || !visible) return;
    qc.invalidateQueries({ queryKey: badgeCountsKey });
    const invalidate = () => qc.invalidateQueries({ queryKey: badgeCountsKey });
    const filter = `store_id=eq.${storeId}`;
    const channel = supabase
      .channel(`admin-badges:${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "returns", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_customers", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversations", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "low_stock_alerts", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_webhook_events", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "landing_page_logs", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_duplicate_blocks", filter }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_product_recommendations", filter }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc, visible]);

  return {
    counts: query.data?.counts ?? EMPTY,
    storeId,
    isLoading: query.isLoading,
  };
}

export function useMarkSeen() {
  const fn = useServerFn(markFeatureSeen);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { store_id: string; feature: BadgeFeature | string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: badgeCountsKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const fn = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { store_id: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: badgeCountsKey }),
  });
}

export function useMarkConversationRead() {
  const fn = useServerFn(markConversationRead);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { conversation_id: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: badgeCountsKey }),
  });
}

/**
 * Convenience: mark a feature seen once when the page mounts.
 * Silently no-ops until storeId is known.
 */
export function useMarkSeenOnMount(feature: BadgeFeature | string | string[]) {
  const { storeId } = useBadgeCounts();
  const mark = useMarkSeen();
  const features = useMemo(() => (Array.isArray(feature) ? feature : [feature]), [feature]);
  useEffect(() => {
    if (!storeId) return;
    for (const f of features) mark.mutate({ store_id: storeId, feature: f });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, features.join(",")]);
}
