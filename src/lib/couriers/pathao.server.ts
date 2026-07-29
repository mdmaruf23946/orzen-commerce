// Pathao Courier adapter — OAuth2 + /aladdin/api/v1
import { call, pickError, trimUrl, type AdapterCtx, type CourierAdapter } from "./types.server";
import { normalizeStatus } from "./status";

async function token(ctx: AdapterCtx): Promise<string> {
  const url = trimUrl(ctx.baseUrl) || "https://api-hermes.pathao.com";
  const c = ctx.creds;
  const r = await call(ctx, "auth", {
    url: `${url}/aladdin/api/v1/issue-token`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      client_id: c.client_id,
      client_secret: c.client_secret,
      username: c.username,
      password: c.password,
      grant_type: "password",
    },
  });
  const t = r.json?.access_token;
  if (!r.ok || !t) throw new Error(r.error ?? "Pathao authentication failed");
  return String(t);
}

export const pathaoAdapter: CourierAdapter = {
  key: "pathao",
  hasApi: true,
  supportsCancel: false,

  async createParcel(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://api-hermes.pathao.com";
    const access = await token(ctx);
    const r = await call(ctx, "create_parcel", {
      url: `${url}/aladdin/api/v1/orders`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: {
        store_id: Number(ctx.creds.store_id) || ctx.creds.store_id,
        merchant_order_id: p.invoice,
        recipient_name: p.recipientName,
        recipient_phone: p.recipientPhone,
        recipient_address: p.recipientAddress,
        recipient_city: numOrNull(p.recipientCity),
        recipient_zone: numOrNull(p.recipientZone),
        recipient_area: numOrNull(p.recipientArea),
        delivery_type: 48,
        item_type: 2,
        special_instruction: p.note ?? "",
        item_quantity: p.itemCount,
        item_weight: p.weight ?? 0.5,
        amount_to_collect: p.codAmount,
        item_description: p.items.map((i) => `${i.name} x${i.qty}`).join(", ").slice(0, 200),
      },
    });
    if (!r.ok) throw new Error(r.error ?? "Pathao create failed");
    const d = r.json?.data ?? {};
    if (!d.consignment_id) throw new Error(pickError(r.json, r.text, "Pathao rejected the parcel"));
    return {
      consignmentId: String(d.consignment_id),
      trackingCode: String(d.consignment_id),
      status: normalizeStatus(d.order_status, "pending"),
      raw: r.json,
    };
  },

  async getStatus(ctx, p) {
    const url = trimUrl(ctx.baseUrl) || "https://api-hermes.pathao.com";
    const access = await token(ctx);
    const r = await call(ctx, "get_status", {
      url: `${url}/aladdin/api/v1/orders/${encodeURIComponent(p.consignmentId ?? "")}/info`,
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!r.ok) throw new Error(r.error ?? "Pathao status failed");
    const d = r.json?.data ?? {};
    const raw = d.order_status ?? d.status;
    return { status: normalizeStatus(raw, "pending"), message: String(raw ?? ""), raw: r.json };
  },
};

function numOrNull(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
