// Built-in avatar and cover templates, rendered as inline SVG so they work on
// any host with no external files. Stored in user metadata as "tpl:<id>".
// To add more: append to AVATAR_PALETTES or COVER_TEMPLATES.

const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

type AvatarPalette = { bg1: string; bg2: string; skin: string; hair: string; shirt: string; style: number };

const AVATAR_PALETTES: AvatarPalette[] = [
  ["#0ea5e9", "#6366f1", "#f1c7a3", "#2d1b12", "#1e293b", 0],
  ["#f97316", "#ef4444", "#e0ac83", "#3b2314", "#0f172a", 1],
  ["#10b981", "#0d9488", "#8d5a3b", "#120c08", "#f8fafc", 2],
  ["#8b5cf6", "#ec4899", "#f5d0b5", "#a16207", "#312e81", 3],
  ["#64748b", "#334155", "#c68863", "#1c1917", "#e2e8f0", 0],
  ["#facc15", "#f97316", "#6b3f26", "#0a0a0a", "#1d4ed8", 1],
  ["#14b8a6", "#3b82f6", "#f3c9a8", "#78350f", "#0f766e", 2],
  ["#f43f5e", "#a855f7", "#d39b74", "#27180f", "#111827", 3],
  ["#22c55e", "#84cc16", "#fadcc4", "#57534e", "#14532d", 0],
  ["#06b6d4", "#0891b2", "#7c4a2d", "#0c0a09", "#fef3c7", 1],
  ["#6366f1", "#1e40af", "#e8b896", "#451a03", "#f1f5f9", 2],
  ["#fb7185", "#f59e0b", "#a0674a", "#1a1110", "#7c2d12", 3],
  ["#0f172a", "#334155", "#f0c4a0", "#b45309", "#38bdf8", 0],
  ["#a3e635", "#16a34a", "#5c3520", "#000000", "#fafafa", 1],
  ["#e879f9", "#7c3aed", "#f7d6bf", "#292524", "#4c1d95", 2],
  ["#38bdf8", "#818cf8", "#c08060", "#3f2a1d", "#0c4a6e", 3],
  ["#fcd34d", "#fb923c", "#f2cba9", "#1f2937", "#9a3412", 0],
  ["#2dd4bf", "#059669", "#94603f", "#171717", "#ecfeff", 1],
  ["#94a3b8", "#475569", "#fbe0ca", "#d97706", "#1e3a8a", 2],
  ["#f472b6", "#db2777", "#6f4430", "#0b0b0b", "#fdf2f8", 3],
  ["#4ade80", "#0ea5e9", "#e6b08c", "#44403c", "#064e3b", 0],
  ["#c084fc", "#6366f1", "#b47555", "#1c0f0a", "#ede9fe", 1],
  ["#fdba74", "#f43f5e", "#f6cfb2", "#7c2d12", "#18181b", 2],
  ["#67e8f9", "#3b82f6", "#88553a", "#0f0f0f", "#1e293b", 3],
].map(([bg1, bg2, skin, hair, shirt, style]) => ({ bg1, bg2, skin, hair, shirt, style }) as AvatarPalette);

function hairPath(style: number, c: string) {
  switch (style) {
    case 0: return `<path d="M62 92c0-24 16-38 38-38s38 14 38 38c-8-12-20-18-38-18s-30 6-38 18z" fill="${c}"/>`;
    case 1: return `<path d="M60 96c-2-28 16-44 40-44s42 16 40 44c-4-6-6-14-8-20-10 6-28 8-52 2-6 4-12 10-20 18z" fill="${c}"/>`;
    case 2: return `<path d="M58 140c-8-50 6-88 42-88s50 38 42 88c-6-24-8-44-10-56-12 4-52 4-64 0-2 12-4 32-10 56z" fill="${c}"/>`;
    default: return `<circle cx="100" cy="66" r="16" fill="${c}"/><path d="M62 94c0-24 16-38 38-38s38 14 38 38c-10-10-24-14-38-14s-28 4-38 14z" fill="${c}"/>`;
  }
}

function avatarSvg(p: AvatarPalette, i: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g${i})"/><path d="M36 200c4-38 30-58 64-58s60 20 64 58z" fill="${p.shirt}"/><rect x="88" y="120" width="24" height="26" rx="10" fill="${p.skin}"/><ellipse cx="100" cy="96" rx="34" ry="38" fill="${p.skin}"/>${hairPath(p.style, p.hair)}</svg>`;
}

export type MediaTemplate = { id: string; label: string; category: string; src: string };

export const AVATAR_TEMPLATES: MediaTemplate[] = AVATAR_PALETTES.map((p, i) => ({
  id: `avatar-${String(i + 1).padStart(2, "0")}`,
  label: `Avatar ${i + 1}`,
  category: "Avatar",
  src: svgUri(avatarSvg(p, i)),
}));

export const COVER_CATEGORIES = ["Professional", "Business", "Technology", "Creative", "E-commerce", "ORZEN"] as const;

const W = 1200, H = 400;
const grad = (id: string, a: string, b: string, angle = "1") =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${angle}" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;

function waves(a: string, b: string, c: string) {
  return wrap(grad("w", a, b), `<rect width="${W}" height="${H}" fill="url(#w)"/><path d="M0 280C200 220 400 340 600 290S1000 200 1200 260V400H0z" fill="${c}" opacity=".35"/><path d="M0 330C250 280 450 380 700 330S1050 280 1200 320V400H0z" fill="${c}" opacity=".5"/>`);
}
function grid(a: string, b: string, line: string) {
  let lines = "";
  for (let x = 0; x <= W; x += 40) lines += `<path d="M${x} 0V${H}"/>`;
  for (let y = 0; y <= H; y += 40) lines += `<path d="M0 ${y}H${W}"/>`;
  return wrap(grad("g", a, b), `<rect width="${W}" height="${H}" fill="url(#g)"/><g stroke="${line}" stroke-width="1" opacity=".18">${lines}</g><circle cx="950" cy="120" r="180" fill="${line}" opacity=".08"/>`);
}
function circuit(a: string, b: string, c: string) {
  let dots = "";
  for (let i = 0; i < 26; i++) {
    const x = (i * 173) % W, y = (i * 97) % H;
    dots += `<path d="M${x} ${y}h60v40h80" fill="none" stroke="${c}" stroke-width="2" opacity=".35"/><circle cx="${x + 140}" cy="${y + 40}" r="4" fill="${c}"/>`;
  }
  return wrap(grad("c", a, b), `<rect width="${W}" height="${H}" fill="url(#c)"/>${dots}`);
}
function blobs(a: string, b: string, c1: string, c2: string) {
  return wrap(grad("b", a, b), `<rect width="${W}" height="${H}" fill="url(#b)"/><circle cx="200" cy="80" r="200" fill="${c1}" opacity=".55"/><circle cx="900" cy="340" r="240" fill="${c2}" opacity=".5"/><circle cx="620" cy="60" r="110" fill="#fff" opacity=".15"/>`);
}
function diagonal(a: string, b: string, c: string) {
  return wrap(grad("d", a, b), `<rect width="${W}" height="${H}" fill="url(#d)"/><path d="M700 0H1200V400H460z" fill="${c}" opacity=".18"/><path d="M880 0H1200V400H700z" fill="${c}" opacity=".18"/>`);
}
function shapes(a: string, b: string, c: string) {
  let s = "";
  const icons = ["M0 0h40v40H0z", "M20 0l20 40H0z", "M20 0a20 20 0 1 0 .1 0z"];
  for (let i = 0; i < 18; i++) s += `<path transform="translate(${(i * 211) % 1150} ${(i * 131) % 360}) rotate(${i * 23} 20 20)" d="${icons[i % 3]}" fill="${c}" opacity=".22"/>`;
  return wrap(grad("s", a, b), `<rect width="${W}" height="${H}" fill="url(#s)"/>${s}`);
}
function orzen(a: string, b: string, c: string) {
  return wrap(grad("o", a, b), `<rect width="${W}" height="${H}" fill="url(#o)"/><circle cx="1000" cy="200" r="260" fill="none" stroke="${c}" stroke-width="40" opacity=".18"/><circle cx="1000" cy="200" r="150" fill="none" stroke="${c}" stroke-width="22" opacity=".25"/><text x="70" y="250" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="150" fill="${c}" opacity=".12" letter-spacing="20">ORZEN</text>`);
}

const COVERS: [string, string, string][] = [
  ["Professional", "Slate waves", waves("#1e293b", "#334155", "#94a3b8")],
  ["Professional", "Navy grid", grid("#0f172a", "#1e3a8a", "#ffffff")],
  ["Professional", "Steel diagonal", diagonal("#475569", "#1e293b", "#ffffff")],
  ["Business", "Ocean waves", waves("#0369a1", "#1d4ed8", "#bae6fd")],
  ["Business", "Emerald diagonal", diagonal("#047857", "#064e3b", "#a7f3d0")],
  ["Business", "Gold grid", grid("#78350f", "#b45309", "#fde68a")],
  ["Technology", "Circuit blue", circuit("#020617", "#0c4a6e", "#38bdf8")],
  ["Technology", "Circuit green", circuit("#022c22", "#064e3b", "#4ade80")],
  ["Technology", "Neon grid", grid("#1e1b4b", "#581c87", "#e879f9")],
  ["Creative", "Sunset blobs", blobs("#f97316", "#db2777", "#facc15", "#7c3aed")],
  ["Creative", "Aurora blobs", blobs("#0ea5e9", "#8b5cf6", "#22d3ee", "#f472b6")],
  ["Creative", "Mint shapes", shapes("#14b8a6", "#6366f1", "#ffffff")],
  ["E-commerce", "Shop coral", shapes("#fb7185", "#f97316", "#ffffff")],
  ["E-commerce", "Market teal", waves("#0f766e", "#0891b2", "#ccfbf1")],
  ["E-commerce", "Sale violet", diagonal("#7c3aed", "#c026d3", "#fdf4ff")],
  ["ORZEN", "ORZEN primary", orzen("#1d4ed8", "#0f172a", "#ffffff")],
  ["ORZEN", "ORZEN night", orzen("#020617", "#1e293b", "#38bdf8")],
  ["ORZEN", "ORZEN warm", orzen("#ea580c", "#9f1239", "#fff7ed")],
];

export const COVER_TEMPLATES: MediaTemplate[] = COVERS.map(([category, label, svg], i) => ({
  id: `cover-${String(i + 1).padStart(2, "0")}`,
  label,
  category,
  src: svgUri(svg),
}));

const ALL = new Map([...AVATAR_TEMPLATES, ...COVER_TEMPLATES].map((t) => [t.id, t.src]));

/** Resolve a stored value (tpl:<id>, http URL, or storage path) to an image src. */
export function resolveMediaSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("tpl:")) return ALL.get(value.slice(4));
  return value.startsWith("http") ? value : `/api/img/${value}`;
}
