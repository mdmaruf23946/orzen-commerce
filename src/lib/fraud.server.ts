// BD Courier adapter + risk computation (server-only helpers).
// Never import from client bundles.

export type FraudThresholds = { safe_max: number; medium_max: number };

export type NormalizedFraud = {
  total_orders: number;
  successful: number;
  cancelled: number;
  returned: number;
  cod_success_rate: number;
  last_delivery: string | null;
  courier_history: any[];
  raw: any;
};

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * BD Courier public API. Endpoint accepts JSON `{ phone }` and Bearer token.
 * Docs: https://bdcourier.com/
 */
export async function callBdCourier(phone: string, apiKey: string): Promise<NormalizedFraud> {
  if (!apiKey) throw new Error("Fraud checker API key is not configured");
  let resp: Response;
  try {
    resp = await fetch("https://bdcourier.com/api/courier-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phone }),
    });
  } catch (e) {
    throw new Error(`Network error reaching bdcourier.com: ${(e as Error).message}`);
  }
  const rawText = await resp.text();
  let raw: any = {};
  try { raw = rawText ? JSON.parse(rawText) : {}; } catch { raw = { body: rawText.slice(0, 400) }; }
  if (!resp.ok) {
    const providerMsg = (raw as any)?.message || (raw as any)?.error || rawText.slice(0, 200);
    const hint =
      resp.status === 401 || resp.status === 403 ? " (check that the API token is valid and active)"
      : resp.status === 404 ? " (endpoint not found — verify BD Courier API URL)"
      : resp.status === 429 ? " (rate limit reached — wait and retry)"
      : resp.status >= 500 ? " (BD Courier server is down, try again shortly)"
      : "";
    throw new Error(`HTTP ${resp.status}: ${providerMsg}${hint}`);
  }


  // Shape: { courierData: { pathao, steadfast, redx, paperfly, parceldex, ecourier, summary }, ... }
  // NOTE: BD Courier nests a "summary" key inside `courierData` — it must NOT be treated
  // as a courier (doing so double-counts totals).
  const couriers = (raw as any)?.courierData ?? (raw as any)?.data ?? {};
  const nestedSummary =
    couriers && typeof couriers === "object" ? (couriers as any).summary : null;
  const topSummary = (raw as any)?.summary ?? (raw as any)?.total ?? null;
  const summary = nestedSummary ?? topSummary ?? {};

  // Always show the standard BD Courier providers, even when the response omits them.
  const KNOWN = ["pathao", "steadfast", "redx", "paperfly", "parceldex", "ecourier"];
  const history: any[] = [];
  let sumTotal = 0, sumSuccess = 0, sumCancelled = 0;

  if (couriers && typeof couriers === "object") {
    const seen = new Set<string>();
    const pushCourier = (key: string, val: any) => {
      if (!val || typeof val !== "object") return;
      const t = toNum(val.total_parcel);
      const s = toNum(val.success_parcel);
      const c = toNum(val.cancelled_parcel);
      sumTotal += t; sumSuccess += s; sumCancelled += c;
      history.push({
        courier: key,
        total: t,
        success: s,
        cancelled: c,
        rate: t > 0 ? Math.round((s / t) * 100) : 0,
      });
      seen.add(key);
    };
    // Known couriers first (in stable order)
    for (const key of KNOWN) {
      if ((couriers as any)[key]) pushCourier(key, (couriers as any)[key]);
      else {
        history.push({ courier: key, total: 0, success: 0, cancelled: 0, rate: 0 });
        seen.add(key);
      }
    }
    // Any additional couriers the API adds later (skip the "summary" bucket)
    for (const [key, val] of Object.entries<any>(couriers)) {
      if (key === "summary" || seen.has(key)) continue;
      pushCourier(key, val);
    }
  }

  // Prefer provider-reported summary; fall back to computed sum
  const total = toNum(summary.total_parcel) || sumTotal;
  const success = toNum(summary.success_parcel) || sumSuccess;
  const cancelled = toNum(summary.cancelled_parcel) || sumCancelled;

  const returned = Math.max(0, total - success - cancelled);
  const cod_success_rate = total > 0 ? (success / total) * 100 : 0;

  return {
    total_orders: total,
    successful: success,
    cancelled,
    returned,
    cod_success_rate: Math.round(cod_success_rate * 10) / 10,
    last_delivery: (raw as any)?.last_delivery ?? null,
    courier_history: history,
    raw,
  };
}

export function computeRisk(
  stats: Pick<NormalizedFraud, "total_orders" | "returned" | "cod_success_rate">,
  thresholds: FraudThresholds,
): "safe" | "medium" | "high" {
  if (stats.total_orders <= 0) return "safe";
  const returnRate = (stats.returned / stats.total_orders) * 100;
  if (returnRate <= thresholds.safe_max) return "safe";
  if (returnRate <= thresholds.medium_max) return "medium";
  return "high";
}
