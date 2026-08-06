/** Server-only ownership helpers shared by the Orders server functions. */
export async function getOwnedStoreId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getOwnedOrder(supabase: any, userId: string, orderId: string) {
  const storeId = await getOwnedStoreId(supabase, userId);
  if (!storeId) throw new Error("Store not found");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,store_id,order_type,confirmation_status,fulfillment_meta")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!order) throw new Error("Order not found");
  return { sb: supabaseAdmin, storeId, order: order as any };
}