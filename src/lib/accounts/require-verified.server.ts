// Server-only guard: sensitive merchant actions require a verified email.
// One verification unlocks the whole account — this is never asked twice.
export async function assertEmailVerified(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data } = await sb
    .from("merchant_security")
    .select("email_verified_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.email_verified_at) return;

  // Sign-up auto-confirmation does not count — only the emailed code does.

  throw new Error(
    "Please verify your email address first (Settings → Account Security), then try again.",
  );
}
