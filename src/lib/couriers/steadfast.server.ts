// SteadFast (Packzy) adapter — https://portal.packzy.com/api/v1
import { call, pickError, trimUrl, type CourierAdapter } from "./types.server";
import { normalizeStatus } from "./status";

export const steadfastAdapter: CourierAdapter = {
  key: "steadfast",
  hasApi: true,
  supportsCancel: false,

  async createParcel(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://portal.packzy.com/api/v1";
    const r = await call(ctx, "create_parcel", {
      url: `${url}/create_order`,
      method: "POST",
      headers: headers(ctx.creds),
      body: {
        invoice: p.invoice,
        recipient_name: p.recipientName,
        recipient_phone: p.recipientPhone,
        recipient_address: p.recipientAddress,
        cod_amount: p.codAmount,
        note: p.note ?? "",
      },
    });
    if (!r.ok) throw new Error(r.error ?? "SteadFast create failed");
    const c = r.json?.consignment ?? r.json?.data ?? {};
    if (r.json?.status && Number(r.json.status) >= 400) {
      throw new Error(pickError(r.json, r.text, "SteadFast rejected the parcel"));
    }
    return {
      consignmentId: c.consignment_id != null ? String(c.consignment_id) : null,
      trackingCode: c.tracking_code ?? null,
      status: normalizeStatus(c.status, "pending"),
      raw: r.json,
    };
  },

  async getStatus(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://portal.packzy.com/api/v1";
    const path = p.consignmentId
      ? `/status_by_cid/${encodeURIComponent(p.consignmentId)}`
      : p.trackingCode
        ? `/status_by_trackingcode/${encodeURIComponent(p.trackingCode)}`
        : `/status_by_invoice/${encodeURIComponent(p.invoice)}`;
    const r = await call(ctx, "get_status", { url: `${url}${path}`, headers: headers(ctx.creds) });
    if (!r.ok) throw new Error(r.error ?? "SteadFast status failed");
    const raw = r.json?.delivery_status ?? r.json?.status;
    return { status: normalizeStatus(raw, "pending"), message: String(raw ?? ""), raw: r.json };
  },
};

function headers(c: Record<string, string>) {
  return {
    "Api-Key": c.api_key ?? "",
    "Secret-Key": c.secret ?? c.api_secret ?? "",
    "Content-Type": "application/json",
  };
}
