// Server-only ownership proof for guest-accessible order pages.
// An order id alone is NOT proof of ownership: callers must present either a
// valid store customer session token or the phone/email used on the order.

export type OwnershipProof = {
  storeId?: string | undefined;
  token?: string | undefined;
  contact?: string | undefined;
};

export async function ownsOrderRecord(
  sb: any,
  order: { id: string; store_id: string; customer_id?: string | null; phone?: string | null; email?: string | null },
  proof: OwnershipProof,
): Promise<boolean> {
  if (!order) return false;

  if (proof.token) {
    const { data: c } = await sb.rpc("customer_from_token", {
      _token: proof.token,
      _store_id: proof.storeId ?? order.store_id,
    } as any);
    const cid = (c as any)?.id;
    if (cid && order.customer_id && cid === order.customer_id) return true;
  }

  const contact = (proof.contact ?? "").trim().toLowerCase();
  if (contact) {
    const orderEmail = String(order.email ?? "").trim().toLowerCase();
    if (orderEmail && orderEmail === contact) return true;
    const digits = (v: string) => v.replace(/\D/g, "");
    const orderPhone = digits(String(order.phone ?? ""));
    const given = digits(contact);
    if (orderPhone && given.length >= 6 && (orderPhone === given || orderPhone.endsWith(given))) {
      return true;
    }
  }
  return false;
}

export async function ownsOrderById(
  sb: any,
  orderId: string,
  proof: OwnershipProof,
): Promise<boolean> {
  const { data: order } = await sb
    .from("orders")
    .select("id,store_id,customer_id,phone,email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  return ownsOrderRecord(sb, order as any, proof);
}
