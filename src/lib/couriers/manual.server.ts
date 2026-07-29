// Manual adapter for couriers without a public merchant API
// (S.A. Paribahan, Sundarban Courier). Parcels are recorded locally and the
// merchant enters the courier's consignment number by hand; the rest of the
// system (timeline, invoice, label, COD, pickup) works identically.
import type { CourierAdapter } from "./types.server";

export function manualAdapter(key: string): CourierAdapter {
  return {
    key,
    hasApi: false,
    async createParcel(_ctx, p) {
      return {
        consignmentId: p.consignmentId ?? null,
        trackingCode: p.trackingCode ?? p.consignmentId ?? null,
        status: "pending",
        raw: { manual: true },
      };
    },
  };
}
