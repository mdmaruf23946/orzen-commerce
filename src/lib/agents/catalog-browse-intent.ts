// "আপনাদের কাছে কি আছে?" / "ki ki ase" / "what do you sell" — the customer wants
// to browse the store, not a specific product. Answered with top product cards
// and zero AI tokens.
const BROWSE = [
  /(আপনাদের|আপনার|তোমাদের|এখানে|আপনাদে|দোকানে|পেজে|শপে)?\s*(কাছে|এ|তে)?\s*(কি|কী)\s*(কি|কী)?\s*(আছে|আসে|পাওয়া যায়|বিক্রি|পাব|পাবো)/,
  /(কি|কী)\s*(কি|কী)?\s*(প্রোডাক্ট|পণ্য|জিনিস|কালেকশন)\s*(আছে|আসে)/,
  /(সব|সকল|আর)\s*(প্রোডাক্ট|পণ্য|কালেকশন)(গুলো)?\s*(দেখান|দেখাও|দিন|দেন)?/,
  /\b(ki\s*ki|ki|kii)\s*(ase|ache|achhe|ase\?|pawa jay|bikri)\b/i,
  /\b(what|which)\s+(do\s+you|you)\s+(sell|have)\b/i,
  /\b(show|see)\s+(me\s+)?(all|your)\s+(products|collection|items)\b/i,
  /\b(your|all)\s+(products|collection)\b/i,
];

export function isCatalogBrowseIntent(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t || t.length > 60) return false;
  // A named product question ("টিশার্ট কি আছে") is a search, not browsing.
  if (/(এটা|এটি|এইটা|ওটা|ঐটা|this|it)\b/i.test(t)) return false;
  if (/দাম|কত|ডেলিভারি|delivery|অর্ডার|order|ট্র্যাক|track|রিটার্ন|return/i.test(t)) return false;
  if (!BROWSE.some((r) => r.test(t))) return false;
  // Strip the browse words; leftovers mean a product name was given.
  const rest = t
    .replace(/আপনাদের|আপনার|তোমাদের|এখানে|দোকানে|পেজে|শপে|কাছে|কি|কী|আছে|আসে|পাওয়া যায়|বিক্রি|পাবো|পাব|প্রোডাক্ট|পণ্য|জিনিস|কালেকশন|সব|সকল|আর|গুলো|দেখান|দেখাও|দিন|দেন|ভাই|আপু|ভাইয়া|plz|please|ki|kii|ase|ache|achhe|pawa|jay|bikri|what|which|do|you|sell|have|show|see|me|all|your|products?|collection|items?|apnader|kase|kache/gi, "")
    .replace(/[\s?？!।.,]+/g, "");
  return rest.length <= 2;
}
