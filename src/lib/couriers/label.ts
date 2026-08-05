// Client-safe helpers for shipping labels.
//
// Important: none of the supported Bangladeshi couriers expose a public
// merchant API endpoint that returns a printable label file. Their official
// labels are produced inside the courier's own merchant panel. So the rule is:
//   1. If the adapter can fetch an official label from the courier API -> use it.
//   2. Otherwise open the courier's official label page for that consignment.
//   3. Only if neither exists, fall back to the ORZEN-generated label.

export type LabelSource = "api" | "panel" | "fallback";

export type LabelResult = {
  source: LabelSource;
  url: string | null;
  message: string;
};

/** Official merchant-panel page where the courier's own label is printed. */
export function courierLabelPanelUrl(
  courierKey: string,
  consignment: string | null | undefined,
): string | null {
  const c = (consignment ?? "").trim();
  switch (courierKey) {
    case "steadfast":
      return c
        ? `https://steadfast.com.bd/user/consignment?search=${encodeURIComponent(c)}`
        : "https://steadfast.com.bd/user/consignment";
    case "pathao":
      return c
        ? `https://merchant.pathao.com/courier/orders?search=${encodeURIComponent(c)}`
        : "https://merchant.pathao.com/courier/orders";
    case "redx":
      return c
        ? `https://redx.com.bd/dashboard/parcels?search=${encodeURIComponent(c)}`
        : "https://redx.com.bd/dashboard/parcels";
    case "paperfly":
      return "https://merchant.paperfly.com.bd/";
    case "ecourier":
      return c
        ? `https://backoffice.ecourier.com.bd/parcel?search=${encodeURIComponent(c)}`
        : "https://backoffice.ecourier.com.bd/parcel";
    default:
      return null;
  }
}

/** Couriers with no merchant API at all — label is written by hand. */
export function labelHelpText(courierKey: string): string {
  switch (courierKey) {
    case "sa_paribahan":
    case "sundarban":
      return "This courier has no merchant API. Use the ORZEN label and write the consignment number issued at the counter.";
    default:
      return "This courier prints its official label from the merchant panel. Opening it now.";
  }
}
