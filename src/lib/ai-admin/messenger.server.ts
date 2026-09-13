// Shared server helpers for the AI Admin Messenger (Facebook Page) connection.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptJSON } from "@/lib/crypto/credentials.server";
import { sendText } from "@/lib/messenger-send.server";

export type AdminMessengerCreds = { page_access_token: string; app_secret?: string };

export type AdminMessengerConnection = {
  id: string;
  status: string;
  page_id: string | null;
  page_name: string | null;
  verify_token: string | null;
  admin_psids: string[] | null;
  credentials_enc: string | null;
  credentials_hint: string | null;
  last_verified_at: string | null;
  last_error: string | null;
};

export async function loadMessengerConnection(client?: any): Promise<AdminMessengerConnection | null> {
  const db = client ?? supabaseAdmin;
  const { data } = await db
    .from("ai_admin_messenger_connections")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  return (data as AdminMessengerConnection | null) ?? null;
}

export function readMessengerCreds(conn: AdminMessengerConnection | null): AdminMessengerCreds | null {
  if (!conn?.credentials_enc) return null;
  try {
    return decryptJSON<AdminMessengerCreds>(conn.credentials_enc);
  } catch {
    return null;
  }
}

/** Send a Messenger text from the connected Facebook Page. */
export async function sendAdminMessengerMessage(psid: string, text: string) {
  const conn = await loadMessengerConnection();
  const creds = readMessengerCreds(conn);
  if (!creds?.page_access_token) throw new Error("Messenger is not connected.");
  return sendText(creds.page_access_token, psid, text.slice(0, 1900));
}
