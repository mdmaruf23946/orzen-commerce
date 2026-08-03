// Server-only helpers for the Service order workflow.
import { normalizeWorkflow, type ServiceWorkflowSettings } from "@/lib/service-workflow";

export const DELIVERABLE_BUCKET = "service-deliverables";

export async function loadServiceOrder(sb: any, orderId: string) {
  const { data } = await sb
    .from("orders")
    .select("id,store_id,order_type,status,fulfillment_meta,created_at,payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!data || (data.order_type ?? "physical") !== "service") return null;
  return data as any;
}

export async function workflowFor(sb: any, storeId: string): Promise<ServiceWorkflowSettings> {
  const { data } = await sb
    .from("service_workflow_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  return normalizeWorkflow(storeId, data);
}

export async function myStoreIdFor(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/** Verify the signed-in owner owns the store the order belongs to. */
export async function ownedOrder(sb: any, userId: string, orderId: string) {
  const storeId = await myStoreIdFor(sb, userId);
  if (!storeId) throw new Error("No store found");
  const { data } = await sb
    .from("orders")
    .select("id,store_id,order_type,fulfillment_meta,status")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) throw new Error("Order not found");
  return data as any;
}

export function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export function decodeB64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Merge a patch into orders.fulfillment_meta.service_state. */
export async function patchServiceState(sb: any, order: any, patch: Record<string, unknown>) {
  const meta = (order.fulfillment_meta ?? {}) as any;
  const next = {
    ...meta,
    service_state: { ...(meta.service_state ?? {}), ...patch },
  };
  await sb.from("orders").update({ fulfillment_meta: next }).eq("id", order.id);
  return next;
}
