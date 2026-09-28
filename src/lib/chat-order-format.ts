// Shared, channel-agnostic formatting helpers for the in-chat (Messenger /
// WhatsApp) Buy Now order flow. Kept free of server-only imports so both the
// Messenger webhook helper and the WhatsApp route can use it.

export type DeliveryZone = {
  id?: string;
  name: string;
  charge: number;
  eta?: string | null;
  is_default?: boolean | null;
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBnDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
}

export function money(amount: number) {
  return `৳${toBnDigits(Math.round(amount))}`;
}

/** Short, customer-friendly order number. Never shows the long internal id. */
export function shortOrderNo(invoiceNo: string | null | undefined, id: string | null | undefined) {
  if (invoiceNo && String(invoiceNo).trim()) return String(invoiceNo).trim();
  if (!id) return "—";
  return String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
}

const STATUS_BN: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  confirmed: "কনফার্মড",
  processing: "প্রস্তুত হচ্ছে",
  delivered: "ডেলিভারি হয়েছে",
  cancelled: "বাতিল",
};
export function orderStatusBn(status: string | null | undefined) {
  const s = String(status ?? "pending");
  return STATUS_BN[s] ?? s;
}

/** Active delivery zones for a store, cheapest first. */
export async function fetchDeliveryZones(sb: any, storeId: string): Promise<DeliveryZone[]> {
  const { data } = await sb
    .from("delivery_zones")
    .select("id,name,charge,eta,is_default,sort_order")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as any[]).map((z) => ({
    id: z.id,
    name: String(z.name ?? ""),
    charge: Number(z.charge ?? 0),
    eta: z.eta ?? null,
    is_default: !!z.is_default,
  }));
}

const OUTSIDE_RE = /outside|বাইরে|বাহিরে|বাইর|out\s*of/i;
const INSIDE_RE = /inside|ভিতরে|ভেতরে|বিতরে|বিতর|মধ্যে|within/i;
const NOISE = new Set([
  "inside", "outside", "within", "zone", "area", "delivery", "charge", "city",
  "ভিতরে", "ভেতরে", "বিতরে", "মধ্যে", "বাইরে", "বাহিরে", "এর", "ডেলিভারি", "চার্জ", "এলাকা",
]);
// Common English/Bangla spellings of the same place.
const ALIASES: Record<string, string[]> = {
  "ঢাকা": ["dhaka"], "ঢাকার": ["dhaka"], "dhaka": ["ঢাকা"],
  "চট্টগ্রাম": ["chittagong", "chattogram"], "chittagong": ["চট্টগ্রাম", "chattogram"], "chattagram": ["chittagong", "chattogram", "চট্টগ্রাম"],
};

function zoneKeywords(name: string) {
  const base = name
    .split(/[\s,/|()-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !NOISE.has(w.toLowerCase()));
  return base.flatMap((w) => [w, ...(ALIASES[w.toLowerCase()] ?? [])]);
}

/**
 * Pick the delivery zone that best matches a free-text address.
 * Falls back to the store's default zone, then the first zone.
 */
export function pickDeliveryZone(address: string, zones: DeliveryZone[]): DeliveryZone | null {
  if (!zones.length) return null;
  const text = String(address ?? "").toLowerCase();
  if (!text.trim()) return zones.find((z) => z.is_default) ?? zones[0]!;

  // Address tokens, so "ঢাকা" still matches a zone named "ঢাকার ভিতরে".
  const tokens = text.split(/[\s,./|()-]+/).map((t) => t.trim()).filter((t) => t.length >= 3);
  const matches = (word: string) => {
    const w = word.toLowerCase();
    if (text.includes(w)) return true;
    return tokens.some((t) => t.startsWith(w.slice(0, 3)) && (t.startsWith(w) || w.startsWith(t)));
  };

  let best: { zone: DeliveryZone; score: number } | null = null;
  for (const zone of zones) {
    const isOutside = OUTSIDE_RE.test(zone.name);
    const words = zoneKeywords(zone.name);
    const hits = words.filter((w) => matches(w)).length;
    if (!hits) continue;
    // "Outside Dhaka" should not win just because the address says Dhaka.
    const score = isOutside ? hits - 0.5 : hits + (INSIDE_RE.test(zone.name) ? 0.5 : 0);
    if (!best || score > best.score) best = { zone, score };
  }
  if (best && best.score > 0) return best.zone;

  // No zone name matched the address → assume it is outside the named city zone.
  const outside = zones.find((z) => OUTSIDE_RE.test(z.name));
  return outside ?? zones.find((z) => z.is_default) ?? zones[0]!;
}

/** The delivery charge for an address, with the product's own charge as fallback. */
export function resolveDeliveryCharge(
  address: string,
  zones: DeliveryZone[],
  productCharge: number | null | undefined,
): { charge: number; zone: DeliveryZone | null } {
  const zone = pickDeliveryZone(address, zones);
  if (zone) return { charge: Number(zone.charge ?? 0), zone };
  return { charge: Number(productCharge ?? 0), zone: null };
}

/** The short, easy-to-follow "give me your details" message. */
export function buildBuyNowMessage(opts: {
  productName: string;
  price: number;
  qty?: number;
  zones: DeliveryZone[];
  productDeliveryCharge?: number | null;
  intro?: string | null;
  /** Labels still missing; when given, only these are asked for. */
  missing?: string[];
  /** Details already collected in chat (shown so the customer can correct them). */
  known?: Record<string, any>;
}) {
  const lines: string[] = [];
  const intro = String(opts.intro ?? "").trim();
  if (intro) lines.push(intro, "");
  const qty = Math.max(1, Number(opts.qty ?? 1) || 1);
  lines.push(`পণ্য: ${opts.productName}${qty > 1 ? ` × ${toBnDigits(qty)}` : ""}`);
  if (Number(opts.price) > 0) lines.push(`দাম: ${money(Number(opts.price) * qty)}`);
  lines.push("");

  if (opts.zones.length) {
    lines.push("ডেলিভারি চার্জ:");
    for (const z of opts.zones) lines.push(`- ${z.name}: ${money(z.charge)}`);
  } else {
    const dc = Number(opts.productDeliveryCharge ?? 0);
    lines.push(`ডেলিভারি চার্জ: ${dc > 0 ? money(dc) : "ঠিকানা অনুযায়ী জানিয়ে দেব"}`);
  }

  lines.push("পেমেন্ট: ক্যাশ অন ডেলিভারি");
  lines.push("");

  const k = opts.known ?? {};
  const have: string[] = [];
  const nm = k.customer_name ?? k.name;
  if (nm) have.push(`নাম: ${nm}`);
  if (k.phone) have.push(`মোবাইল: ${k.phone}`);
  if (k.address) have.push(`ঠিকানা: ${k.address}`);

  if (opts.missing && opts.missing.length && have.length) {
    lines.push("আপনার দেওয়া তথ্য:");
    for (const h of have) lines.push(`- ${h}`);
    lines.push("");
    if (opts.missing.length === 1) {
      lines.push(`শুধু আপনার ${opts.missing[0]} লিখে পাঠান।`);
    } else {
      lines.push("শুধু নিচের তথ্যগুলো লিখে পাঠান:");
      opts.missing.forEach((m, i) => lines.push(`${toBnDigits(i + 1)}) ${m}`));
    }
    return lines.join("\n");
  }

  lines.push("অর্ডার করতে নিচের তথ্যগুলো লিখে পাঠান:");
  const ask = opts.missing && opts.missing.length ? opts.missing : ["আপনার নাম", "মোবাইল নম্বর", "সম্পূর্ণ ঠিকানা"];
  ask.forEach((m, i) => lines.push(`${toBnDigits(i + 1)}) ${m}`));

  return lines.join("\n");
}


/** Short reminder listing only the fields still missing, in the same order. */
export function buildMissingFieldsMessage(missingLabels: string[]) {
  if (!missingLabels.length) return "";
  const numbered = missingLabels.map((label, i) => `${toBnDigits(i + 1)}) ${label}`);
  return ["অর্ডারটি কনফার্ম করতে আর একটু তথ্য দরকার:", "", ...numbered].join("\n");
}
