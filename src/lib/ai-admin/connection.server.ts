// Shared server helpers for the AI Admin WhatsApp connection.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptJSON } from "@/lib/crypto/credentials.server";
import { sendWhatsapp } from "@/lib/notify/whatsapp.server";

export type AdminCreds = { access_token: string; app_secret?: string };

export type AdminConnection = {
  id: string;
  status: string;
  phone_number_id: string | null;
  waba_id: string | null;
  display_number: string | null;
  verify_token: string | null;
  credentials_enc: string | null;
  credentials_hint: string | null;
  last_verified_at: string | null;
  last_error: string | null;
};

export async function loadConnection(): Promise<AdminConnection | null> {
  const { data } = await supabaseAdmin
    .from("ai_admin_connections")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  return (data as AdminConnection | null) ?? null;
}

export function readCreds(conn: AdminConnection | null): AdminCreds | null {
  if (!conn?.credentials_enc) return null;
  try {
    return decryptJSON<AdminCreds>(conn.credentials_enc);
  } catch {
    return null;
  }
}

export async function loadSettings() {
  const { data } = await supabaseAdmin.from("ai_admin_settings").select("*").eq("singleton", true).maybeSingle();
  return data;
}

/** Send a WhatsApp text from the configured AI Admin number. */
export async function sendAdminMessage(to: string, text: string) {
  const conn = await loadConnection();
  const creds = readCreds(conn);
  if (!conn?.phone_number_id || !creds?.access_token) throw new Error("WhatsApp is not connected.");
  return sendWhatsapp({
    phoneNumberId: conn.phone_number_id,
    accessToken: creds.access_token,
    to,
    text,
  });
}
