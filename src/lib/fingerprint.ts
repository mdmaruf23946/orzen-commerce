// Lightweight client-only browser fingerprint + persistent device id.
// No external SDK. Used for duplicate-order protection only.

const DEVICE_KEY = "orzen_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const parts: string[] = [];
    parts.push(navigator.userAgent || "");
    parts.push(navigator.language || "");
    parts.push(String(navigator.hardwareConcurrency ?? ""));
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(String(new Date().getTimezoneOffset()));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 200; canvas.height = 40;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 200, 40);
        ctx.fillStyle = "#069";
        ctx.fillText("orzen-fp-🛒", 2, 2);
        parts.push(canvas.toDataURL());
      }
    } catch { /* ignore */ }
    return await sha256Hex(parts.join("|"));
  } catch {
    return "";
  }
}
