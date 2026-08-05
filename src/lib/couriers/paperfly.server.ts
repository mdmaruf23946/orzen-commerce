// Paperfly adapter — Basic auth + paperflykey header
import { basicAuth, call, pickError, trimUrl, type CourierAdapter } from "./types.server";
import { normalizeStatus } from "./status";

function headers(c: Record<string, string>) {
  return {
    Authorization: basicAuth(c.username ?? "", c.password ?? ""),
    paperflykey: c.api_key ?? "",
    "Content-Type": "application/json",
  };
}

export const paperflyAdapter: CourierAdapter = {
  key: "paperfly",
  hasApi: true,
  requiredCreds: [["username"], ["password"], ["api_key"]],

  async createParcel(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://mplog.paperfly.com.bd/api";
    const pk = ctx.pickup ?? {};
    const r = await call(ctx, "create_parcel", {
      url: `${url}/OrderPlacement/`,
      method: "POST",
      headers: headers(ctx.creds),
      body: {
        merOrderRef: p.invoice,
        pickMerchantName: pk.contactName ?? "",
        pickMerchantAddress: pk.address ?? "",
        pickMerchantThana: pk.area ?? "",
        pickMerchantDistrict: pk.district ?? "",
        pickupMerchantPhone: pk.phone ?? "",
        productSizeWeight: "standard",
        productBrief: p.items.map((i) => `${i.name} x${i.qty}`).join(", ").slice(0, 200),
        packagePrice: String(p.codAmount),
        deliveryOption: "Regular",
        custname: p.recipientName,
        custaddress: p.recipientAddress,
        customerThana: p.recipientArea ?? "",
        customerDistrict: p.recipientCity ?? "",
        custPhone: p.recipientPhone,
festival: "",
        max_weight: String(p.weight ?? 1),
        notes: p.note ?? "",
      },
    });
    if (!r.ok) throw new Error(r.error ?? "Paperfly create failed");
    const ref = r.json?.tracking_number ?? r.json?.ReferenceNumber ?? r.json?.data?.tracking_number;
    if (!ref) throw new Error(pickError(r.json, r.text, "Paperfly rejected the parcel"));
    return {
      consignmentId: String(ref),
      trackingCode: String(ref),
      status: "pending",
      raw: r.json,
    };
  },

  async getStatus(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://mplog.paperfly.com.bd/api";
    const r = await call(ctx, "get_status", {
      url: `${url}/OrderStatus/`,
      method: "POST",
      headers: headers(ctx.creds),
      body: { ReferenceNumber: p.consignmentId ?? p.invoice },
    });
    if (!r.ok) throw new Error(r.error ?? "Paperfly status failed");
    const raw = r.json?.order_status ?? r.json?.status ?? r.json?.data?.status;
    return { status: normalizeStatus(raw, "pending"), message: String(raw ?? ""), raw: r.json };
  },
};
