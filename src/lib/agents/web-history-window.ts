// Zero-token rolling window for Web Chat: keep the last N UI messages verbatim
// and fold older customer lines into a short deterministic summary line.
export const WEB_WINDOW = 4;
const SUMMARY_MAX = 280;

type Msg = { role: string; parts?: any[] };

function textOf(m: Msg): string {
  return (m.parts ?? [])
    .map((p: any) => (p?.type === "text" ? String(p.text ?? "") : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function windowWebHistory<T extends Msg>(messages: T[], window = WEB_WINDOW) {
  if (messages.length <= window) return { recent: messages, summary: "" };
  let cut = messages.length - window;
  // never start the window on an assistant/tool turn
  while (cut < messages.length - 1 && messages[cut].role !== "user") cut++;
  const older = messages.slice(0, cut);
  const lines = older
    .filter((m) => m.role === "user")
    .map(textOf)
    .filter(Boolean)
    .slice(-4)
    .map((t) => (t.length > 70 ? t.slice(0, 70) + "…" : t));
  let summary = lines.length ? `Earlier customer said: ${lines.join(" | ")}` : "";
  if (summary.length > SUMMARY_MAX) summary = summary.slice(0, SUMMARY_MAX) + "…";
  return { recent: messages.slice(cut), summary };
}
