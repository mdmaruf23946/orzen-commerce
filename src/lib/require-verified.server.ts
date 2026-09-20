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

  // Merchants who confirmed their address at sign-up count as verified.
  try {
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const res = await fetch(`${process.env["SUPABASE_URL"]}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const user = (await res.json()) as { email_confirmed_at?: string | null };
      if (user?.email_confirmed_at) {
        await sb
          .from("merchant_security")
          .upsert(
            { user_id: userId, email_verified_at: user.email_confirmed_at },
            { onConflict: "user_id" },
          );
        return;
      }
    }
  } catch {
    /* fall through to the verification prompt */
  }

  throw new Error(
    "Please verify your email address first (Settings → Account Security), then try again.",
  );
}
