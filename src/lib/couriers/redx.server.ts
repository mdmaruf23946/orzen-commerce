// RedX adapter — https://openapi.redx.com.bd
import { call, pickError, trimUrl, type CourierAdapter } from "./types.server";
import { normalizeStatus } from "./status";

function headers(c: Record<string, string>) {
  return {
    "API-ACCESS-TOKEN": `Bearer ${c.api_key ?? ""}`,
    "Content-Type": "application/json",
  };
}

export const redxAdapter: CourierAdapter = {
  key: "redx",
  hasApi: true,
  requiredCreds: [["api_key"]],

  async createParcel(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://openapi.redx.com.bd/v1.0.0-beta";
    const r = await call(ctx, "create_parcel", {
      url: `${url}/parcel`,
      method: "POST",
      headers: headers(ctx.creds),
      body: {
        customer_name: p.recipientName,
        customer_phone: p.recipientPhone,
        delivery_area: p.recipientArea ?? p.recipientCity ?? "",
        delivery_area_id: Number(p.recipientZone) || undefined,
        customer_address: p.recipientAddress,
        merchant_invoice_id: p.invoice,
        cash_collection_amount: String(p.codAmount),
        parcel_weight: Math.round(((p.weight ?? 0.5) as number) * 1000),
        instruction: p.note ?? "",
        value: p.codAmount,
        parcel_details_json: p.items.map((i) => ({
          name: i.name,
          category: "general",
          value: i.price ?? 0,
        })),
      },
    });
    if (!r.ok) throw new Error(r.error ?? "RedX create failed");
    const id = r.json?.tracking_id ?? r.json?.data?.tracking_id;
    if (!id) throw new Error(pickError(r.json, r.text, "RedX rejected the parcel"));
    return {
      consignmentId: String(id),
      trackingCode: String(id),
      status: "pending",
      raw: r.json,
    };
  },

  async getStatus(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://openapi.redx.com.bd/v1.0.0-beta";
    const r = await call(ctx, "get_status", {
      url: `${url}/parcel/track/${encodeURIComponent(p.trackingCode ?? p.consignmentId ?? "")}`,
      headers: headers(ctx.creds),
    });
    if (!r.ok) throw new Error(r.error ?? "RedX status failed");
    const tracking = r.json?.tracking ?? r.json?.data ?? [];
    const latest = Array.isArray(tracking) ? tracking[tracking.length - 1] : tracking;
    const raw = latest?.message_en ?? latest?.status ?? r.json?.status;
    return { status: normalizeStatus(raw, "pending"), message: String(raw ?? ""), raw: r.json };
  },
};
