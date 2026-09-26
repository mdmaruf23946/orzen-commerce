// Platform-wide Facebook (Meta) app credentials, configured once by the
// platform owner in the Owner panel. Every merchant's "Auto Connect" flow
// uses these credentials, so merchants never touch app IDs or secrets.
//
// Server-only: this module decrypts the stored app secret.
import { serverEnv } from "@/lib/server-env";

export type MetaAppCreds = { appId: string; appSecret: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Owner-configured credentials from the database, or null when unset. */
export async function readStoredMetaApp(): Promise<
  { appId: string | null; appSecret: string | null; updatedAt: string | null }
> {
  try {
    const sb = await admin();
    const { data } = await sb
      .from("platform_meta_app")
      .select("app_id, app_secret_encrypted, updated_at")
      .eq("id", 1)
      .maybeSingle();
    const row = data as any;
    if (!row) return { appId: null, appSecret: null, updatedAt: null };
    let secret: string | null = null;
    if (row.app_secret_encrypted) {
      try {
        const { decryptJSON } = await import("@/lib/crypto/credentials.server");
        secret = decryptJSON<string>(row.app_secret_encrypted);
      } catch {
        secret = null;
      }
    }
    return {
      appId: row.app_id ? String(row.app_id) : null,
      appSecret: secret,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    };
  } catch {
    return { appId: null, appSecret: null, updatedAt: null };
  }
}

/**
 * Credentials used by the Auto Connect flow. The owner-configured values in
 * the database win; hosting environment variables stay supported as a
 * fallback so an existing deployment keeps working.
 */
export async function resolveMetaAppCreds(): Promise<MetaAppCreds | null> {
  const stored = await readStoredMetaApp();
  if (stored.appId && stored.appSecret) return { appId: stored.appId, appSecret: stored.appSecret };
  const appId = serverEnv("META_APP_ID");
  const appSecret = serverEnv("META_APP_SECRET");
  if (appId && appSecret) return { appId, appSecret };
  return null;
}

/** Saves the owner-configured app credentials (secret stored encrypted). */
export async function writeStoredMetaApp(input: { appId: string; appSecret: string | null }) {
  const sb = await admin();
  const patch: Record<string, unknown> = { id: 1, app_id: input.appId };
  if (input.appSecret) {
    const { encryptJSON } = await import("@/lib/crypto/credentials.server");
    patch['app_secret_encrypted'] = encryptJSON(input.appSecret);
  }
  const { error } = await sb.from("platform_meta_app").upsert(patch, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function clearStoredMetaApp() {
  const sb = await admin();
  const { error } = await sb
    .from("platform_meta_app")
    .update({ app_id: null, app_secret_encrypted: null })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

/** Verifies the pair with Facebook by requesting an app access token. */
export async function verifyMetaAppCreds(creds: MetaAppCreds): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(
        creds.appId,
      )}&client_secret=${encodeURIComponent(creds.appSecret)}&grant_type=client_credentials`,
    );
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.access_token) {
      return { ok: false, error: j?.error?.message || `Facebook rejected these credentials (${r.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not reach Facebook" };
  }
}
