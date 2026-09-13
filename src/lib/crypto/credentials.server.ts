// Server-only AES-256-GCM helpers for encrypting every kind of sensitive
// credential (payments, WhatsApp, Messenger, notification providers).
// Never import from client-reachable modules at module scope.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// One shared server-side encryption mechanism. The generic name is preferred;
// the legacy payment-specific name stays supported so already-stored
// credentials keep decrypting.
const KEY_ENV_NAMES = ["CREDENTIALS_ENCRYPTION_KEY", "PAYMENT_CREDENTIALS_KEY"] as const;

function keyMaterials(): Buffer[] {
  const raws = KEY_ENV_NAMES.map((n) => process.env[n]).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (raws.length === 0) {
    throw new Error(
      "Credential encryption key is not configured on the server. Set CREDENTIALS_ENCRYPTION_KEY.",
    );
  }
  // Derive a stable 32-byte key regardless of the source length/encoding.
  return raws.map((raw) => createHash("sha256").update(raw).digest());
}

function key(): Buffer {
  return keyMaterials()[0]!;
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
  let lastError: unknown;
  // Try every configured key so credentials stored under the legacy key still open.
  for (const k of keyMaterials()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", k, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
      return JSON.parse(plain) as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to decrypt stored credentials");
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
