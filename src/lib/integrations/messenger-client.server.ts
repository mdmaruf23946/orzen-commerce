// Extracted from the Messenger webhook; preserve existing channel behaviour.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function admin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Messenger backend configuration is missing");
  return createClient<Database>(
    url,
    key,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type MessengerClient = ReturnType<typeof admin>;
