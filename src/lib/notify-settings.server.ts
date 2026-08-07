// Server-only load/save for store notification settings (secrets encrypted).
import { encryptJSON, decryptJSON } from "@/lib/crypto/credentials.server";
import { normalizeSettings, computeState, type ChannelKey, type NotifySettings } from "@/lib/notify-settings";

type Sb = any;

export type StoredSettings = NotifySettings & Record<string, any>;

export async function loadSettings(sb: Sb, storeId: string): Promise<StoredSettings> {
  const { data } = await sb.from("stores").select("notifications").eq("id", storeId).maybeSingle();
  return normalizeSettings((data as any)?.notifications) as StoredSettings;
}

export async function saveSettings(sb: Sb, storeId: string, settings: StoredSettings) {
  const { error } = await sb.from("stores").update({ notifications: settings }).eq("id", storeId);
  if (error) throw new Error(error.message);
}

const SECRET_FIELDS: Record<ChannelKey, string[]> = {
  whatsapp: ["access_token"],
  email: ["api_key"],
  sms: ["api_key"],
};

/** Strip secrets, expose has_* booleans and a computed state. */
export function redact(settings: StoredSettings) {
  const out: any = JSON.parse(JSON.stringify(settings));
  for (const key of Object.keys(SECRET_FIELDS) as ChannelKey[]) {
    const ch = out[key] ?? {};
    for (const f of SECRET_FIELDS[key]) {
      ch[`has_${f}`] = !!ch[`${f}_enc`];
      delete ch[`${f}_enc`];
      delete ch[f];
    }
    if (key === "whatsapp") ch.has_token = ch.has_access_token;
    ch.status = { ...(ch.status ?? {}), state: computeState(key, ch) };
    out[key] = ch;
  }
  return out;
}

export function encryptSecret(value: string): string {
  return encryptJSON({ v: value });
}

export function readSecret(stored?: string | null): string | null {
  if (!stored) return null;
  try {
    return (decryptJSON(stored) as any)?.v ?? null;
  } catch {
    return null;
  }
}
