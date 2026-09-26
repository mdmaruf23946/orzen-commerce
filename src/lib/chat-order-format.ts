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

const OUTSIDE_RE = /outside|বাইরে|বাহিরে|out\s*of/i;
const INSIDE_RE = /inside|ভিতরে|ভেতরে|মধ্যে|within/i;
const NOISE_RE =
  /\b(inside|outside|within|zone|area|delivery|charge|ভিতরে|ভেতরে|মধ্যে|বাইরে|বাহিরে|এর|ডেলিভারি|চার্জ|এলাকা)\b/gi;

function zoneKeywords(name: string) {
  return name
    .replace(NOISE_RE, " ")
    .split(/[\s,/|()-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
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

/** The numbered, easy-to-follow "give me your details" message. */
export function buildBuyNowMessage(opts: {
  productName: string;
  price: number;
  qty?: number;
  zones: DeliveryZone[];
  productDeliveryCharge?: number | null;
  intro?: string | null;
}) {
  const qty = Math.max(1, Number(opts.qty ?? 1) || 1);
  const subtotal = Number(opts.price ?? 0) * qty;
  const lines: string[] = [];

  if (opts.intro && opts.intro.trim()) lines.push(opts.intro.trim(), "");

  lines.push(`🛍️ প্রোডাক্ট: ${opts.productName}`);
  lines.push(`💰 মূল্য: ${money(subtotal)}${qty > 1 ? ` (${toBnDigits(qty)} পিস)` : ""}`);
  lines.push("");

  if (opts.zones.length) {
    lines.push("🚚 ডেলিভারি চার্জ:");
    for (const z of opts.zones) {
      lines.push(`• ${z.name}: ${money(z.charge)}${z.eta ? ` (${z.eta})` : ""}`);
    }
    lines.push("👉 আপনার ঠিকানা অনুযায়ী ডেলিভারি চার্জ যোগ হবে।");
  } else {
    const dc = Number(opts.productDeliveryCharge ?? 0);
    lines.push(`🚚 ডেলিভারি চার্জ: ${dc > 0 ? money(dc) : "ঠিকানা অনুযায়ী জানিয়ে দেব"}`);
  }

  lines.push("");
  lines.push("💵 পেমেন্ট: ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা দেবেন)");
  lines.push("────────────────");
  lines.push("অর্ডার কনফার্ম করতে নিচের তথ্যগুলো সিরিয়াল অনুযায়ী লিখে পাঠান:");
  lines.push("");
  lines.push("১) আপনার পুরো নাম");
  lines.push("২) মোবাইল নম্বর");
  lines.push("৩) ইমেইল (না থাকলে বাদ দিন)");
  lines.push("৪) সম্পূর্ণ ঠিকানা (গ্রাম/বাসা, থানা, জেলা)");
  lines.push("৫) অতিরিক্ত নোট (ঐচ্ছিক)");
  lines.push("");
  lines.push("উদাহরণ:");
  lines.push("১) রহিম উদ্দিন");
  lines.push("২) ০১৭XXXXXXXX");
  lines.push("৩) rahim@gmail.com");
  lines.push("৪) বাড়ি ১২, রোড ৫, মিরপুর, ঢাকা");
  lines.push("৫) বিকেলে ডেলিভারি দিলে ভালো হয়");

  return lines.join("\n");
}

/** Short reminder listing only the fields still missing, in the same order. */
export function buildMissingFieldsMessage(missingLabels: string[]) {
  if (!missingLabels.length) return "";
  const numbered = missingLabels.map((label, i) => `${toBnDigits(i + 1)}) ${label}`);
  return ["অর্ডারটি কনফার্ম করতে আর একটু তথ্য দরকার:", "", ...numbered].join("\n");
}
