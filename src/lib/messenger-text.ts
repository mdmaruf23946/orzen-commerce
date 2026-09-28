// Removes "pointer" phrases from outgoing Messenger text when the referenced
// element (card, image, link/button) is not actually part of the payload.

export type PayloadFacts = {
  hasCard?: boolean;
  hasImage?: boolean;
  hasLink?: boolean;
  hasButton?: boolean;
};

type Rule = { re: RegExp; needs: (f: PayloadFacts) => boolean };

const VISUAL = (f: PayloadFacts) => Boolean(f.hasCard || f.hasImage);
const LINKY = (f: PayloadFacts) => Boolean(f.hasLink || f.hasButton || f.hasCard);

// Sentence-level patterns. Each is dropped when its requirement is unmet.
const RULES: Rule[] = [
  // Bangla — image / below pointers
  { re: /[^।\n.!?]*(ছবি(টি|গুলো)?|ইমেজ)[^।\n.!?]*(নিচে|দিলাম|দেখুন|পাঠালাম|দেখে নিন)[^।\n.!?]*[।.!?]?/gi, needs: VISUAL },
  { re: /[^।\n.!?]*(নিচে\s*(দেখুন|দিলাম|দেওয়া|দেয়া|আছে|পাবেন))[^।\n.!?]*[।.!?]?/gi, needs: (f) => VISUAL(f) || LINKY(f) },
  { re: /[^।\n.!?]*(নিচের\s*(ছবি|কার্ড|লিংক|লিঙ্ক|বাটন))[^।\n.!?]*[।.!?]?/gi, needs: (f) => VISUAL(f) || LINKY(f) },
  // Bangla — link / button pointers
  { re: /[^।\n.!?]*(এই\s*(লিংক|লিঙ্ক)|লিংকে\s*ক্লিক|লিঙ্কে\s*ক্লিক|বাটনে\s*ক্লিক|বাটনে\s*চাপ)[^।\n.!?]*[।.!?]?/gi, needs: LINKY },
  // English
  { re: /[^\n.!?]*\b(see|check|find)\s+(the\s+)?(image|photo|picture|card|details)?\s*below\b[^\n.!?]*[.!?]?/gi, needs: (f) => VISUAL(f) || LINKY(f) },
  { re: /[^\n.!?]*\b(below\s+(is|are)\s+the\s+(image|photo|picture|card))\b[^\n.!?]*[.!?]?/gi, needs: VISUAL },
  { re: /[^\n.!?]*\b(click|tap)\s+(on\s+)?(the\s+)?(link|button)\b[^\n.!?]*[.!?]?/gi, needs: LINKY },
  { re: /[^\n.!?]*\b(here'?s|attaching|sending)\s+(the\s+)?(image|photo|picture)\b[^\n.!?]*[.!?]?/gi, needs: VISUAL },
];

export function sanitizeOutgoingText(text: string, facts: PayloadFacts = {}): string {
  let out = String(text ?? "");
  if (!out.trim()) return out;

  for (const rule of RULES) {
    if (rule.needs(facts)) continue;
    out = out.replace(rule.re, "");
  }

  // Dangling "point down" emoji with nothing following it.
  if (!VISUAL(facts) && !LINKY(facts)) {
    out = out.replace(/[👇⬇️↓]+/g, "");
  }

  // Strip bare URLs when we did not intend to send a link.
  if (!facts.hasLink && !facts.hasButton && !facts.hasCard) {
    out = out.replace(/https?:\/\/\S+/gi, "");
  }

  out = out
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s।.,!?-]+/, "")
    // "চান? ?" / "!!" / "।।" → one mark.
    .replace(/([?？!।])(?:\s*[?？!।])+/g, "$1")
    .trim();

  return out;
}
