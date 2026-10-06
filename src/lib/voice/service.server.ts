// VoiceService: the only entry point the rest of the app uses for provider calls.
import { createHash, randomBytes } from "node:crypto";
import { encryptJSON, decryptJSON } from "@/lib/crypto/credentials.server";
import { epbxProvider } from "./epbx.server";
import { VoiceProviderError, type VoiceCreds, type VoiceProvider, type VoiceProviderId } from "./types";

const REGISTRY: Record<VoiceProviderId, VoiceProvider> = { epbx: epbxProvider };

export function getVoiceProvider(id: string): VoiceProvider {
  const p = REGISTRY[id as VoiceProviderId];
  if (!p) throw new VoiceProviderError("not_supported", "This calling provider is not supported.");
  return p;
}

export function sealToken(token: string, baseUrl?: string) {
  return { enc: encryptJSON({ api_token: token, ...(baseUrl ? { base_url: baseUrl } : {}) } satisfies VoiceCreds), preview: `••••${token.slice(-4)}` };
}

export function openToken(enc: string | null): VoiceCreds | null {
  if (!enc) return null;
  try { return decryptJSON<VoiceCreds>(enc); } catch { return null; }
}

export function newWebhookSecret() {
  const secret = randomBytes(24).toString("hex");
  return { secret, hash: hashSecret(secret) };
}

export function hashSecret(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Friendly message only — never raw provider errors. */
export function friendlyVoiceError(e: unknown): string {
  if (e instanceof VoiceProviderError) {
    if (e.code === "invalid_token") return "Unable to connect to ePBX. Please check your API token.";
    if (e.code === "insufficient_balance") return "Your ePBX balance is too low to place this call.";
    if (e.code === "invalid_phone") return "The customer phone number is not valid.";
    if (e.code === "rate_limited") return "ePBX is busy right now. Please try again in a minute.";
    return e.message;
  }
  console.error("[voice] provider error", (e as Error)?.message);
  return "The calling provider is unavailable right now. Please try again later.";
}

export async function auditVoice(admin: any, storeId: string, userId: string | null, action: string, metadata: Record<string, unknown> = {}) {
  try {
    await admin.from("voice_audit_log").insert({ store_id: storeId, user_id: userId, action, metadata });
  } catch { /* audit never blocks */ }
}
