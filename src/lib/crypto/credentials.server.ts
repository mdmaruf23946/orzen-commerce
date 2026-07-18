// Server-only AES-256-GCM helpers for encrypting store payment credentials.
// Never import from client-reachable modules at module scope.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key(): Buffer {
  const raw = process.env.PAYMENT_CREDENTIALS_KEY;
  if (!raw) throw new Error("PAYMENT_CREDENTIALS_KEY is not set");
  // Derive a stable 32-byte key regardless of the source length/encoding.
  return createHash("sha256").update(raw).digest();
}

export function encryptJSON(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptJSON<T = unknown>(stored: string): T {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}

// Build a masked preview like "••••1234" from the most identifying credential
// field so the UI can hint which credentials are on file without leaking them.
export function credentialsPreview(creds: Record<string, unknown>): string {
  const candidates = ["store_id", "merchant_id", "api_key", "app_key", "client_id", "username"];
  for (const k of candidates) {
    const v = creds[k];
    if (typeof v === "string" && v.length >= 4) return "••••" + v.slice(-4);
  }
  const first = Object.values(creds).find((v) => typeof v === "string" && (v as string).length >= 4);
  return typeof first === "string" ? "••••" + first.slice(-4) : "••••••";
}
