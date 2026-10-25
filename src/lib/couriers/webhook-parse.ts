// Pure parser for courier webhook payloads (SteadFast, Pathao, RedX, Paperfly, eCourier).
import { normalizeStatus, type ParcelStatus } from "./status";

export type WebhookUpdate = {
  consignmentId: string | null;
  trackingCode: string | null;
  invoice: string | null;
  status: ParcelStatus | null;
  message: string | null;
  codCollected: number | null;
  courierFee: number | null;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 120) : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseCourierWebhook(body: any): WebhookUpdate {
  const b = body?.data && typeof body.data === "object" ? { ...body, ...body.data } : body ?? {};
  const rawStatus =
    b.delivery_status ?? b.order_status ?? b.status ?? b.parcel_status ?? b.event ?? b.notification_type;
  const status = rawStatus != null && String(rawStatus).trim() ? normalizeStatus(rawStatus, "pending") : null;
  return {
    consignmentId: str(b.consignment_id ?? b.consignmentId ?? b.tracking_id ?? b.trackingId),
    trackingCode: str(b.tracking_code ?? b.trackingCode ?? b.tracking_number ?? b.ecr),
    invoice: str(b.invoice ?? b.merchant_order_id ?? b.merchant_invoice_id ?? b.merchantOrderId ?? b.order_id),
    status,
    message: str(b.tracking_message ?? b.message ?? b.reason ?? rawStatus),
    codCollected: num(b.collected_amount ?? b.cash_collection ?? b.cod_collected ?? b.collected_cash),
    courierFee: num(b.delivery_charge ?? b.delivery_fee ?? b.charge ?? b.total_fee),
  };
}
