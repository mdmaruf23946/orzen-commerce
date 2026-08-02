// Confirmation engine for non-physical orders (digital / service / subscription).
// Physical orders never pass through here — their workflow is untouched.
type Sb = any;

export type OrderKind = "physical" | "digital" | "service" | "subscription";
export type ConfirmMode = "auto" | "manual";

export const DEFAULT_CONFIRMATION: Record<Exclude<OrderKind, "physical">, ConfirmMode> = {
  digital: "auto",
  service: "manual",
  subscription: "manual",
};

export function normalizeConfirmation(raw: any) {
  const pick = (k: keyof typeof DEFAULT_CONFIRMATION): ConfirmMode =>
    raw?.[k] === "manual" || raw?.[k] === "auto" ? raw[k] : DEFAULT_CONFIRMATION[k];
  return {
    digital: pick("digital"),
    service: pick("service"),
    subscription: pick("subscription"),
  };
}

/** Reads the store's confirmation preference for one order kind. */
export async function confirmationModeFor(
  sb: Sb,
  storeId: string,
  kind: OrderKind,
): Promise<ConfirmMode> {
  if (kind === "physical") return "auto";
  const { data } = await sb.from("stores").select("order_confirmation").eq("id", storeId).maybeSingle();
  return normalizeConfirmation((data as any)?.order_confirmation)[kind];
}

function addCycle(from: Date, cycle: string | null | undefined) {
  const d = new Date(from);
  switch (cycle) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "half_yearly": d.setMonth(d.getMonth() + 6); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "lifetime": return null;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

/** Runs the fulfilment action that belongs to one order kind. */
export async function runConfirmationActions(sb: Sb, order: any) {
  const kind: OrderKind = order.order_type ?? "physical";
  const meta = (order.fulfillment_meta ?? {}) as any;

  if (kind === "digital") {
    const { activateDigitalAccess } = await import("@/lib/digital.server");
    await activateDigitalAccess(sb, order.id);
    return;
  }
  if (kind === "service") {
    await sb
      .from("orders")
      .update({ fulfillment_meta: { ...meta, service_state: meta.service_state === "completed" ? "completed" : "scheduled" } })
      .eq("id", order.id);
    return;
  }
  if (kind === "subscription") {
    const renewal = meta.renewal_at ?? addCycle(new Date(), meta.billing_cycle);
    await sb
      .from("orders")
      .update({
        fulfillment_meta: {
          ...meta,
          subscription_state: "active",
          activated_at: meta.activated_at ?? new Date().toISOString(),
          renewal_at: renewal,
        },
      })
      .eq("id", order.id);
  }
}

/** Marks an order confirmed and executes its fulfilment actions. Idempotent. */
export async function confirmOrderRow(sb: Sb, orderId: string) {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,order_type,confirmation_status,fulfillment_meta")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  if ((order as any).order_type === "physical") return { confirmed: false };

  if ((order as any).confirmation_status !== "confirmed") {
    await sb
      .from("orders")
      .update({ confirmation_status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", orderId);
  }
  await runConfirmationActions(sb, order);
  return { confirmed: true };
}

/**
 * Called right after a payment is recorded as paid. Auto-confirms when the
 * store prefers it, otherwise leaves the order pending for manual review.
 */
export async function handlePaymentConfirmed(sb: Sb, orderId: string) {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,order_type,confirmation_status,fulfillment_meta")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { confirmed: false };
  const kind: OrderKind = (order as any).order_type ?? "physical";

  if (kind === "physical") {
    // Legacy safety net: older physical orders may still carry digital items.
    const { activateDigitalAccess } = await import("@/lib/digital.server");
    await activateDigitalAccess(sb, orderId);
    return { confirmed: false };
  }

  const mode = await confirmationModeFor(sb, (order as any).store_id, kind);
  if (mode !== "auto") return { confirmed: false, pending: true };
  return confirmOrderRow(sb, orderId);
}
