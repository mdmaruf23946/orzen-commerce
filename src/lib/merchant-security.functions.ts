// Merchant account security: email verification codes, password-reset codes,
// and two-factor (TOTP) status. Security email goes through the dedicated
// security mailer, never through the notification pipeline.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
/** Resend rules shared with the UI countdown. */
export const RESEND_COOLDOWN_SEC = 30;
export const MAX_SENDS_PER_WINDOW = 3;
export const SEND_WINDOW_MIN = 15;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function sha256(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

function newCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

function authHeaders() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  return { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
}

function authBase() {
  return `${process.env["SUPABASE_URL"]}/auth/v1`;
}

/** Look up an auth user by email through the Admin API. */
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const res = await fetch(
    `${authBase()}/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=10`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
  const hit = (body.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email.trim().toLowerCase(),
  );
  return hit?.email ? { id: hit.id, email: hit.email } : null;
}

async function getAdminUser(userId: string): Promise<any | null> {
  const res = await fetch(`${authBase()}/admin/users/${userId}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function ensureSecurityRow(userId: string) {
  const sb = await admin();
  const { data } = await sb
    .from("merchant_security")
    .select("user_id,email_verified_at,totp_enabled,backup_code_hashes")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data;
  await sb.from("merchant_security").insert({ user_id: userId }).select("user_id").maybeSingle();
  return {
    user_id: userId,
    email_verified_at: null,
    totp_enabled: false,
    backup_code_hashes: [],
  };
}

async function logSend(template: string, to: string, status: string, error?: string) {
  try {
    const sb = await admin();
    await sb.from("email_send_log").insert({
      template_name: template,
      recipient_email: to,
      status,
      error_message: error ?? null,
    });
  } catch {
    /* logging must never break the flow */
  }
}

/** Cloudflare Turnstile check; a no-op while the secret is not configured. */
async function requireHuman(captcha?: string) {
  const { verifyTurnstile, TURNSTILE_FAILED_BN } = await import("@/lib/turnstile.server");
  const res = await verifyTurnstile(captcha);
  if (!res.ok) throw new Error(TURNSTILE_FAILED_BN);
}

/** Issue a fresh code, enforcing send throttles. Returns the plain code. */
async function issueCode(userId: string, email: string, purpose: "email_verify" | "password_reset") {
  const { guardServerFn } = await import("@/lib/rate-limit.server");
  await guardServerFn("auth", `code:${userId}`);
  const sb = await admin();
  const now = Date.now();
  const { data: recent } = await sb
    .from("merchant_auth_codes")
    .select("created_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .gte("created_at", new Date(now - SEND_WINDOW_MIN * 60_000).toISOString())
    .order("created_at", { ascending: false });
  const rows = (recent ?? []) as Array<{ created_at: string }>;
  if (rows.length >= MAX_SENDS_PER_WINDOW) {
    throw new Error(
      `You have already requested ${MAX_SENDS_PER_WINDOW} codes. Please try again in ${SEND_WINDOW_MIN} minutes.`,
    );
  }
  if (rows[0] && now - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_SEC * 1000) {
    throw new Error(
      `A code was just sent. Please wait ${RESEND_COOLDOWN_SEC} seconds before requesting another.`,
    );
  }

  const code = newCode();
  await sb.from("merchant_auth_codes").insert({
    user_id: userId,
    email,
    purpose,
    code_hash: await sha256(`${userId}:${code}`),
    expires_at: new Date(now + CODE_TTL_MIN * 60_000).toISOString(),
  });
  return code;
}

/** Validate and consume a code. Throws a user-facing message on failure. */
async function consumeCode(
  userId: string,
  purpose: "email_verify" | "password_reset",
  code: string,
) {
  const sb = await admin();
  const { data } = await sb
    .from("merchant_auth_codes")
    .select("id,code_hash,expires_at,attempts,consumed_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("No active code. Please request a new one.");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("This code has expired. Please request a new one.");
  }
  if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
    throw new Error("Too many wrong attempts. Please request a new code.");
  }
  const hash = await sha256(`${userId}:${code.trim()}`);
  if (hash !== data.code_hash) {
    await sb
      .from("merchant_auth_codes")
      .update({ attempts: (data.attempts ?? 0) + 1 })
      .eq("id", data.id);
    throw new Error("The code is incorrect.");
  }
  await sb
    .from("merchant_auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);
}

// ---------------------------------------------------------------- status

export const mySecurityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as any;
    const row = await ensureSecurityRow(userId);
    const user = await getAdminUser(userId);
    const factors: any[] = (user?.factors ?? []).filter(
      (f: any) => f.factor_type === "totp" && f.status === "verified",
    );
    const totpEnabled = factors.length > 0;
    if (totpEnabled !== !!row.totp_enabled) {
      const sb = await admin();
      await sb.from("merchant_security").update({ totp_enabled: totpEnabled }).eq("user_id", userId);
    }
    return {
      email: (user?.email ?? claims?.email ?? null) as string | null,
      emailVerified: !!row.email_verified_at,
      verifiedAt: row.email_verified_at as string | null,
      totpEnabled,
      backupCodesLeft: (row.backup_code_hashes ?? []).length,
    };
  });

// ------------------------------------------------- email verification code

export const requestEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as any;
    const row = await ensureSecurityRow(userId);
    if (row.email_verified_at) return { ok: true, alreadyVerified: true as const };
    const user = await getAdminUser(userId);
    const email: string | null = user?.email ?? claims?.email ?? null;
    if (!email) throw new Error("No email address on this account.");

    const code = await issueCode(userId, email, "email_verify");
    const { sendAuthEmail, verifyCodeEmail } = await import("@/lib/auth-mailer.server");
    const mail = await verifyCodeEmail(code, CODE_TTL_MIN);
    try {
      await sendAuthEmail({ to: email, subject: mail.subject, html: mail.html });
      await logSend("auth-email-verify-code", email, "sent");
    } catch (e) {
      await logSend("auth-email-verify-code", email, "failed", String((e as Error).message));
      throw e;
    }
    return { ok: true, alreadyVerified: false as const, email };
  });

export const confirmEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(4).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await ensureSecurityRow(userId);
    await consumeCode(userId, "email_verify", data.code);
    const sb = await admin();
    await sb
      .from("merchant_security")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("user_id", userId);
    // Keep Supabase's own confirmation flag in sync.
    await fetch(`${authBase()}/admin/users/${userId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ email_confirm: true }),
    });
    return { ok: true };
  });

// --------------------------------------------------- password reset by code

export const requestPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        captcha: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireHuman(data.captcha);
    const user = await findUserByEmail(data.email);
    // Always report success: never reveal whether an account exists.
    if (!user) return { ok: true };
    try {
      const code = await issueCode(user.id, user.email, "password_reset");
      const { sendAuthEmail, resetCodeEmail } = await import("@/lib/auth-mailer.server");
      const mail = await resetCodeEmail(code, CODE_TTL_MIN);
      await sendAuthEmail({ to: user.email, subject: mail.subject, html: mail.html });
      await logSend("auth-password-reset-code", user.email, "sent");
    } catch (e) {
      await logSend("auth-password-reset-code", user.email, "failed", String((e as Error).message));
      throw e;
    }
    return { ok: true };
  });

export const confirmPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        code: z.string().trim().min(4).max(10),
        password: z.string().min(8).max(200),
        captcha: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireHuman(data.captcha);
    const user = await findUserByEmail(data.email);
    if (!user) throw new Error("The code is incorrect.");
    await consumeCode(user.id, "password_reset", data.code);
    const res = await fetch(`${authBase()}/admin/users/${user.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ password: data.password }),
    });
    if (!res.ok) throw new Error("Could not update the password. Please try again.");
    return { ok: true };
  });

// ----------------------------------------------------------------- 2FA

/** Called after a client-side TOTP enroll/unenroll to refresh flags + alert. */
export const syncTotpStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const row = await ensureSecurityRow(userId);
    const user = await getAdminUser(userId);
    const enabled = (user?.factors ?? []).some(
      (f: any) => f.factor_type === "totp" && f.status === "verified",
    );
    const sb = await admin();
    const patch: Record<string, unknown> = { totp_enabled: enabled };
    let backupCodes: string[] | null = null;
    if (enabled && (row.backup_code_hashes ?? []).length === 0) {
      backupCodes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).slice(2, 7).toUpperCase() +
        "-" +
        Math.random().toString(36).slice(2, 7).toUpperCase(),
      );
      patch["backup_code_hashes"] = await Promise.all(
        backupCodes.map((c) => sha256(`${userId}:${c}`)),
      );
    }
    if (!enabled) patch["backup_code_hashes"] = [];
    await sb.from("merchant_security").update(patch).eq("user_id", userId);

    if (enabled !== !!row.totp_enabled && user?.email) {
      const { sendAuthEmail, twoFactorChangedEmail } = await import("@/lib/auth-mailer.server");
      const mail = await twoFactorChangedEmail(enabled);
      try {
        await sendAuthEmail({ to: user.email, subject: mail.subject, html: mail.html });
      } catch {
        /* alert failure must not block the security change */
      }
    }
    return { totpEnabled: enabled, backupCodes };
  });

export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    await ensureSecurityRow(userId);
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).slice(2, 7).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase(),
    );
    const hashes = await Promise.all(codes.map((c) => sha256(`${userId}:${c}`)));
    const sb = await admin();
    await sb.from("merchant_security").update({ backup_code_hashes: hashes }).eq("user_id", userId);
    return { codes };
  });

/**
 * Lost-phone recovery: verify email + password + one backup code, then remove
 * the TOTP factor so the merchant can sign in with the password alone.
 */
export const recoverWithBackupCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(1).max(200),
        code: z.string().trim().min(6).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await findUserByEmail(data.email);
    if (!user) throw new Error("Invalid email, password or backup code.");

    // Verify the password without creating a usable session elsewhere.
    const pw = await fetch(`${authBase()}/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    if (!pw.ok) throw new Error("Invalid email, password or backup code.");

    const sb = await admin();
    const row = await ensureSecurityRow(user.id);
    const hash = await sha256(`${user.id}:${data.code.trim().toUpperCase()}`);
    const hashes: string[] = row.backup_code_hashes ?? [];
    if (!hashes.includes(hash)) throw new Error("Invalid email, password or backup code.");

    const adminUser = await getAdminUser(user.id);
    for (const f of adminUser?.factors ?? []) {
      await fetch(`${authBase()}/admin/users/${user.id}/factors/${f.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    }
    await sb
      .from("merchant_security")
      .update({ totp_enabled: false, backup_code_hashes: hashes.filter((h) => h !== hash) })
      .eq("user_id", user.id);

    const { sendAuthEmail, twoFactorChangedEmail } = await import("@/lib/auth-mailer.server");
    const mail = await twoFactorChangedEmail(false);
    try {
      await sendAuthEmail({ to: user.email, subject: mail.subject, html: mail.html });
    } catch {
      /* ignore */
    }
    return { ok: true };
  });
