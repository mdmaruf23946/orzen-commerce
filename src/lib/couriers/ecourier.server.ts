// eCourier adapter — User-Id / API-KEY / API-SECRET headers
import { call, pickError, trimUrl, type CourierAdapter } from "./types.server";
import { normalizeStatus } from "./status";

function headers(c: Record<string, string>) {
  return {
    "API-KEY": c.api_key ?? "",
    "API-SECRET": c.api_secret ?? c.secret ?? "",
    "USER-ID": c.user_id ?? "",
    "Content-Type": "application/json",
  };
}

export const ecourierAdapter: CourierAdapter = {
  key: "ecourier",
  hasApi: true,
  supportsPickup: true,

  async createParcel(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://backoffice.ecourier.com.bd/api";
    const pk = ctx.pickup ?? {};
    const r = await call(ctx, "create_parcel", {
      url: `${url}/order-place`,
      method: "POST",
      headers: headers(ctx.creds),
      body: {
        recipient_name: p.recipientName,
        recipient_mobile: p.recipientPhone,
        recipient_city: p.recipientCity ?? "",
        recipient_area: p.recipientArea ?? "",
        recipient_thana: p.recipientZone ?? "",
        recipient_address: p.recipientAddress,
        package_code: p.invoice,
        product_price: String(p.codAmount),
        payment_method: p.codAmount > 0 ? "COD" : "Prepaid",
        pick_hub: pk.area ?? "",
        product_id: "Parcel",
        number_of_item: String(p.itemCount),
        actual_product_price: String(p.codAmount),
        comments: p.note ?? "",
      },
    });
    if (!r.ok) throw new Error(r.error ?? "eCourier create failed");
    const id = r.json?.tracking ?? r.json?.data?.tracking ?? r.json?.ID;
    if (!id) throw new Error(pickError(r.json, r.text, "eCourier rejected the parcel"));
    return { consignmentId: String(id), trackingCode: String(id), status: "pending", raw: r.json };
  },

  async getStatus(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://backoffice.ecourier.com.bd/api";
    const r = await call(ctx, "get_status", {
      url: `${url}/track`,
      method: "POST",
      headers: headers(ctx.creds),
      body: { product_id: p.trackingCode ?? p.consignmentId ?? "" },
    });
    if (!r.ok) throw new Error(r.error ?? "eCourier status failed");
    const raw = r.json?.status ?? r.json?.data?.status;
    return { status: normalizeStatus(raw, "pending"), message: String(raw ?? ""), raw: r.json };
  },
};
