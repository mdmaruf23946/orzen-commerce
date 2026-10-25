import { describe, it, expect } from "vitest";
import { parseCourierWebhook } from "./webhook-parse";

describe("parseCourierWebhook", () => {
  it("reads a SteadFast delivered payload", () => {
    const u = parseCourierWebhook({ consignment_id: 123, invoice: "INV1", status: "delivered", cod_amount: 1500, delivery_charge: 60 });
    expect(u.consignmentId).toBe("123");
    expect(u.status).toBe("delivered");
    expect(u.courierFee).toBe(60);
  });
  it("reads a Pathao returned payload with collected amount", () => {
    const u = parseCourierWebhook({ consignment_id: "DL1", merchant_order_id: "INV2", event: "order.returned", collected_amount: 0, delivery_fee: 110 });
    expect(u.status).toBe("returned");
    expect(u.codCollected).toBe(0);
    expect(u.invoice).toBe("INV2");
  });
});
