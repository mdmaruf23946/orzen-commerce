// Client-safe parcel status vocabulary shared by the UI and every adapter.

export const PARCEL_STATUSES = [
  "draft",
  "pending",
  "pickup_requested",
  "pickup_completed",
  "in_transit",
  "delivered",
  "partial_delivered",
  "returned",
  "cancelled",
  "hold",
  "failed",
] as const;

export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

export const STATUS_LABEL: Record<ParcelStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  pickup_requested: "Pickup Requested",
  pickup_completed: "Pickup Completed",
  in_transit: "In Transit",
  delivered: "Delivered",
  partial_delivered: "Partial Delivery",
  returned: "Returned",
  cancelled: "Cancelled",
  hold: "Hold",
  failed: "Failed",
};

/** Tailwind classes for a status chip (semantic tokens only). */
export const STATUS_TONE: Record<ParcelStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pickup_requested: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  pickup_completed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  in_transit: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  partial_delivered: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  returned: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  cancelled: "bg-destructive/10 text-destructive",
  hold: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  failed: "bg-destructive/10 text-destructive",
};

export const COLLECTION_STATUSES = ["pending", "collected", "paid", "not_applicable"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

/** Statuses that are still moving and therefore worth polling. */
export const ACTIVE_STATUSES: ParcelStatus[] = [
  "pending",
  "pickup_requested",
  "pickup_completed",
  "in_transit",
  "hold",
];

const RULES: Array<[RegExp, ParcelStatus]> = [
  [/partial/i, "partial_delivered"],
  [/deliver(ed|y_?complete)/i, "delivered"],
  [/return|rtn|rto/i, "returned"],
  [/cancel/i, "cancelled"],
  [/hold|on_?hold|paused/i, "hold"],
  [/(in[_\s-]?transit|shipped|on[_\s-]?the[_\s-]?way|out[_\s-]?for[_\s-]?delivery|received[_\s-]?at|transfer)/i, "in_transit"],
  [/(pickup[_\s-]?(complete|done)|picked)/i, "pickup_completed"],
  [/(pickup|pick[_\s-]?up)/i, "pickup_requested"],
  [/(fail|unable|reject|error)/i, "failed"],
  [/(pending|created|placed|new|confirm|approved|processing|in[_\s-]?review)/i, "pending"],
];

/** Map any courier's raw status string onto our unified vocabulary. */
export function normalizeStatus(raw: unknown, fallback: ParcelStatus = "pending"): ParcelStatus {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  if ((PARCEL_STATUSES as readonly string[]).includes(s)) return s as ParcelStatus;
  for (const [re, status] of RULES) if (re.test(s)) return status;
  return fallback;
}

/** Public tracking page for each courier, when one exists. */
export function buildTrackingUrl(
  courierKey: string,
  tracking: string | null | undefined,
  phone?: string | null,
): string | null {
  const t = (tracking ?? "").trim();
  if (!t) return null;
  switch (courierKey) {
    case "steadfast":
      return `https://steadfast.com.bd/t/${encodeURIComponent(t)}`;
    case "pathao":
      return `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(t)}${
        phone ? `&phone=${encodeURIComponent(phone)}` : ""
      }`;
    case "redx":
      return `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(t)}`;
    case "paperfly":
      return `https://paperfly.com.bd/track-your-parcel/?ref=${encodeURIComponent(t)}`;
    case "ecourier":
      return `https://ecourier.com.bd/tracking/?track=${encodeURIComponent(t)}`;
    case "sa_paribahan":
      return `https://saparibahanltd.com/tracking?consignment=${encodeURIComponent(t)}`;
    case "sundarban":
      return `https://sundarbancourierltd.com/tracking?consignment=${encodeURIComponent(t)}`;
    default:
      return null;
  }
}

/** Couriers without a public merchant API — parcels are tracked manually. */
export const MANUAL_COURIERS = ["sa_paribahan", "sundarban"] as const;

export function isManualCourier(key: string) {
  return (MANUAL_COURIERS as readonly string[]).includes(key);
}
