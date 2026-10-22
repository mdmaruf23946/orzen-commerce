// Merchant-to-merchant delegated access (Profile → Access & Permissions).
// Only the real owner of a store can invite / change / revoke access to it —
// the panel's active-store selection is never used for these decisions, so a
// delegated member can never re-share someone else's store.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DELEGATE_ROLES, GRANTABLE_SECTIONS, SECTION_BY_KEY } from "@/lib/panel-sections";

const ROLE = z.enum(DELEGATE_ROLES.map((r) => r.value) as [string, ...string[]]);
const ROLE_LABEL: Record<string, string> = Object.fromEntries(DELEGATE_ROLES.map((r) => [r.value, r.label]));

function cleanPermissions(input: Record<string, string> | undefined) {
  const allowed = new Set(GRANTABLE_SECTIONS.map((s) => s.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (allowed.has(k) && (v === "view" || v === "manage")) out[k] = v;
  }
  return out;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The store the caller truly owns (ignores the panel's active-store header). */
async function ownStore(supabase: any, userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id,name,owner_user_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Only a store owner can manage access");
  return data as { id: string; name: string; owner_user_id: string };
}

function displayName(claims: any) {
  const m = claims?.user_metadata ?? {};
  return String(m.full_name ?? m.name ?? claims?.email ?? "A merchant");
}

async function log(sb: any, row: Record<string, unknown>) {
  try {
    await sb.from("staff_activity_log").insert({ section: "access", meta: {}, ...row });
  } catch {
    /* best-effort */
  }
}

function summary(perms: Record<string, string>) {
  const names = Object.entries(perms).map(
    ([k, v]) => `${SECTION_BY_KEY[k]?.label ?? k}${v === "view" ? " (view)" : ""}`,
  );
  return names.length ? names.join(", ") : "No sections";
}

function siteOrigin() {
  try {
    const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "orzen.top";
    const proto = getRequestHeader("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "https://orzen.top";
  }
}

async function sendInviteEmail(args: {
  to: string;
  storeName: string;
  inviter: string;
  role: string;
  perms: Record<string, string>;
  link: string;
}) {
  try {
    const { renderPlatformEmail } = await import("@/lib/brevo.server");
    const { sendAuthEmail } = await import("@/lib/auth-mailer.server");
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const html = await renderPlatformEmail({
      kind: "security",
      title: `${args.storeName} — Merchant Panel access`,
      preheader: `${args.inviter} invited you to ${args.storeName}`,
      bodyHtml:
        `<p style="margin:0 0 12px"><strong>${esc(args.inviter)}</strong> আপনাকে <strong>${esc(args.storeName)}</strong> স্টোরের Merchant Panel-এ অ্যাক্সেস দিতে চান।</p>` +
        `<p style="margin:0 0 6px">Role: <strong>${esc(args.role)}</strong></p>` +
        `<p style="margin:0 0 16px;color:#64716b;font-size:13px">Permissions: ${esc(summary(args.perms))}</p>` +
        `<p style="margin:0 0 16px"><a href="${args.link}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review Access</a></p>` +
        `<p style="margin:0;color:#64716b;font-size:13px">লিংকে গিয়ে লগইন করে Accept বা Decline করুন। কোনো পাসওয়ার্ড শেয়ার করার দরকার নেই। আমন্ত্রণটি ৭ দিন কার্যকর।</p>`,
      sanitizeBody: false,
    } as any);
    await sendAuthEmail({ to: args.to, subject: `Access invitation: ${args.storeName}`, html });
    return true;
  } catch (e) {
    console.warn("[delegated-access] invite email failed", e instanceof Error ? e.message : e);
    return false;
  }
}

async function createInviteToken() {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return { token, hash: await sha256(token) };
}

/** Stores the caller can switch between: own store + active memberships. */
export const listMyStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const uid = context.userId;
    const [{ data: own }, { data: memberships }] = await Promise.all([
      sb.from("stores").select("id,name,logo_url,name_logo_url,icon_url,primary_color").eq("owner_user_id", uid).maybeSingle(),
      sb
        .from("store_staff")
        .select("store_id,role,access_type,expires_at,stores(id,name,logo_url,name_logo_url,icon_url,primary_color)")
        .eq("user_id", uid)
        .eq("status", "active"),
    ]);
    const now = Date.now();
    const list: Array<{ id: string; name: string; logo: string | null; color: string | null; role: string; kind: "owner" | "employee" | "delegated" }> = [];
    if (own) list.push({ id: own.id, name: own.name, logo: own.name_logo_url ?? own.logo_url ?? own.icon_url ?? null, color: own.primary_color ?? null, role: "Owner", kind: "owner" });
    for (const m of memberships ?? []) {
      if (m.expires_at && new Date(m.expires_at).getTime() <= now) continue;
      const s = (m as any).stores;
      if (!s || s.id === own?.id) continue;
      list.push({
        id: s.id,
        name: s.name,
        logo: s.name_logo_url ?? s.logo_url ?? s.icon_url ?? null,
        color: s.primary_color ?? null,
        role: ROLE_LABEL[m.role] ?? m.role,
        kind: m.access_type === "delegated" ? "delegated" : "employee",
      });
    }
    return list;
  });

/** Verify + record a store switch. Returns the store id to remember (null = own store). */
export const switchStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storeId: string | null }) => z.object({ storeId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.storeId) return { storeId: null };
    const sb = await admin();
    const { data: own } = await sb.from("stores").select("id").eq("owner_user_id", context.userId).maybeSingle();
    if (own?.id === data.storeId) return { storeId: null };
    const { data: m } = await sb
      .from("store_staff")
      .select("id,name,expires_at,stores(name)")
      .eq("user_id", context.userId)
      .eq("store_id", data.storeId)
      .eq("status", "active")
      .maybeSingle();
    if (!m || (m.expires_at && new Date(m.expires_at).getTime() <= Date.now())) {
      throw new Error("You don't have active access to this store");
    }
    await sb.from("store_staff").update({ last_active_at: new Date().toISOString() }).eq("id", m.id);
    await log(sb, {
      store_id: data.storeId,
      actor_user_id: context.userId,
      actor_staff_id: m.id,
      actor_name: m.name,
      actor_kind: "employee",
      action: "access.open",
      summary: `${m.name} accessed ${(m as any).stores?.name ?? "the store"}`,
    });
    return { storeId: data.storeId };
  });

/** Everything the Access & Permissions section shows. */
export const getAccessOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const uid = context.userId;
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    const { data: own } = await sb.from("stores").select("id,name").eq("owner_user_id", uid).maybeSingle();

    const [people, sent, incoming, mine] = await Promise.all([
      own
        ? sb
            .from("store_staff")
            .select("id,user_id,name,email,role,status,permissions,expires_at,last_active_at,joined_at,created_at")
            .eq("store_id", own.id)
            .eq("access_type", "delegated")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      own
        ? sb
            .from("store_access_invitations")
            .select("id,email,display_name,role,permissions,status,expires_at,access_expires_at,created_at")
            .eq("store_id", own.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      email
        ? sb
            .from("store_access_invitations")
            .select("id,role,permissions,status,expires_at,invited_by_name,created_at,stores(name)")
            .ilike("email", email)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
        : Promise.resolve({ data: [] }),
      sb
        .from("store_staff")
        .select("id,store_id,role,status,permissions,expires_at,last_active_at,stores(name)")
        .eq("user_id", uid)
        .eq("access_type", "delegated"),
    ]);

    // Avatars of people with access (from their own account metadata).
    const avatars: Record<string, string | null> = {};
    for (const p of (people.data ?? []) as any[]) {
      if (!p.user_id) continue;
      try {
        const { data: u } = await sb.auth.admin.getUserById(p.user_id);
        avatars[p.user_id] = (u?.user?.user_metadata as any)?.avatar_url ?? null;
      } catch {
        avatars[p.user_id] = null;
      }
    }

    return {
      isOwner: !!own,
      storeName: own?.name ?? null,
      people: ((people.data ?? []) as any[]).map((p) => ({ ...p, avatar: p.user_id ? avatars[p.user_id] ?? null : null })),
      sent: sent.data ?? [],
      incoming: ((incoming.data ?? []) as any[]).map((i) => ({ ...i, store_name: i.stores?.name ?? "Store" })),
      mine: ((mine.data ?? []) as any[]).map((m) => ({ ...m, store_name: m.stores?.name ?? "Store" })),
    };
  });

const InviteInput = z.object({
  email: z.string().trim().email().max(255),
  displayName: z.string().trim().max(80).optional().nullable(),
  role: ROLE,
  permissions: z.record(z.string(), z.enum(["none", "view", "manage"])).optional(),
  accessExpiresAt: z.string().datetime().optional().nullable(),
});

export const inviteAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof InviteInput>) => InviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownStore(context.supabase, context.userId);
    const email = data.email.toLowerCase();
    const myEmail = String((context.claims as any)?.email ?? "").toLowerCase();
    if (email === myEmail) throw new Error("You can't invite yourself");
    const perms = cleanPermissions(data.permissions as any);
    if (!Object.keys(perms).length) throw new Error("Select at least one permission");
    const sb = await admin();

    const { data: existing } = await sb
      .from("store_staff")
      .select("id")
      .eq("store_id", store.id)
      .ilike("email", email)
      .eq("status", "active")
      .maybeSingle();
    if (existing) throw new Error("This person already has access to your store");

    await sb
      .from("store_access_invitations")
      .update({ status: "cancelled" })
      .eq("store_id", store.id)
      .ilike("email", email)
      .eq("status", "pending");

    const { token, hash } = await createInviteToken();
    const inviter = displayName(context.claims);
    const { error } = await sb.from("store_access_invitations").insert({
      store_id: store.id,
      email,
      display_name: data.displayName || null,
      role: data.role,
      permissions: perms,
      access_expires_at: data.accessExpiresAt || null,
      token_hash: hash,
      invited_by: context.userId,
      invited_by_name: inviter,
    });
    if (error) throw new Error(error.message);

    const link = `${siteOrigin()}/access/invite/${token}`;
    const emailed = await sendInviteEmail({ to: email, storeName: store.name, inviter, role: ROLE_LABEL[data.role] ?? data.role, perms, link });
    await log(sb, {
      store_id: store.id,
      actor_user_id: context.userId,
      actor_name: inviter,
      actor_kind: "owner",
      action: "access.invite",
      summary: `Access invitation sent to ${email} (${ROLE_LABEL[data.role] ?? data.role})`,
    });
    return { ok: true, emailed, link };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownStore(context.supabase, context.userId);
    const sb = await admin();
    const { data: inv } = await sb
      .from("store_access_invitations")
      .select("id,email,role,permissions,status")
      .eq("id", data.id)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!inv || inv.status !== "pending") throw new Error("Invitation not found");
    const { token, hash } = await createInviteToken();
    await sb
      .from("store_access_invitations")
      .update({ token_hash: hash, expires_at: new Date(Date.now() + 7 * 864e5).toISOString() })
      .eq("id", inv.id);
    const link = `${siteOrigin()}/access/invite/${token}`;
    const emailed = await sendInviteEmail({
      to: inv.email,
      storeName: store.name,
      inviter: displayName(context.claims),
      role: ROLE_LABEL[inv.role] ?? inv.role,
      perms: inv.permissions ?? {},
      link,
    });
    return { ok: true, emailed, link };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownStore(context.supabase, context.userId);
    const sb = await admin();
    await sb
      .from("store_access_invitations")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("store_id", store.id)
      .eq("status", "pending");
    return { ok: true };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  role: ROLE,
  permissions: z.record(z.string(), z.enum(["none", "view", "manage"])),
  accessExpiresAt: z.string().datetime().optional().nullable(),
});

export const updateAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof UpdateInput>) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownStore(context.supabase, context.userId);
    const sb = await admin();
    const perms = cleanPermissions(data.permissions as any);
    const { data: row, error } = await sb
      .from("store_staff")
      .update({ role: data.role, permissions: perms, expires_at: data.accessExpiresAt || null })
      .eq("id", data.id)
      .eq("store_id", store.id)
      .eq("access_type", "delegated")
      .select("email")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Access not found");
    await log(sb, {
      store_id: store.id,
      actor_user_id: context.userId,
      actor_name: displayName(context.claims),
      actor_kind: "owner",
      action: "access.update",
      summary: `Access updated for ${row.email}`,
    });
    return { ok: true };
  });

export const revokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await ownStore(context.supabase, context.userId);
    const sb = await admin();
    const { data: row } = await sb
      .from("store_staff")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("store_id", store.id)
      .eq("access_type", "delegated")
      .select("email")
      .maybeSingle();
    if (!row) throw new Error("Access not found");
    await log(sb, {
      store_id: store.id,
      actor_user_id: context.userId,
      actor_name: displayName(context.claims),
      actor_kind: "owner",
      action: "access.revoke",
      summary: `Access revoked from ${row.email}`,
    });
    return { ok: true };
  });

/** A member leaves a store they were given access to. */
export const leaveStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await sb
      .from("store_staff")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("access_type", "delegated");
    return { ok: true };
  });

async function findInvite(sb: any, input: { token?: string; id?: string }) {
  let q = sb
    .from("store_access_invitations")
    .select("id,store_id,email,display_name,role,permissions,status,expires_at,access_expires_at,invited_by,invited_by_name,stores(name)");
  if (input.token) q = q.eq("token_hash", await sha256(input.token));
  else if (input.id) q = q.eq("id", input.id);
  else return null;
  const { data } = await q.maybeSingle();
  return data;
}

const RespondInput = z.object({
  token: z.string().min(20).max(200).optional(),
  id: z.string().uuid().optional(),
});

export const getInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RespondInput>) => RespondInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const inv = await findInvite(sb, data);
    if (!inv) return { found: false as const };
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    const matches = inv.email.toLowerCase() === email;
    return {
      found: true as const,
      matches,
      email: matches ? inv.email : null,
      status: inv.status,
      expired: new Date(inv.expires_at).getTime() <= Date.now(),
      storeName: matches ? inv.stores?.name ?? "Store" : null,
      inviter: matches ? inv.invited_by_name : null,
      role: matches ? ROLE_LABEL[inv.role] ?? inv.role : null,
      permissionSummary: matches ? summary(inv.permissions ?? {}) : null,
    };
  });

export const respondInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RespondInput> & { accept: boolean }) =>
    RespondInput.extend({ accept: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const inv = await findInvite(sb, data);
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    if (!inv || inv.email.toLowerCase() !== email) throw new Error("Invitation not found for this account");
    if (inv.status !== "pending") throw new Error("This invitation is no longer active");
    if (new Date(inv.expires_at).getTime() <= Date.now()) throw new Error("This invitation has expired");
    if (inv.invited_by === context.userId) throw new Error("You can't accept your own invitation");

    const now = new Date().toISOString();
    if (!data.accept) {
      await sb.from("store_access_invitations").update({ status: "declined", responded_at: now }).eq("id", inv.id);
      return { ok: true, storeId: null };
    }

    // Prove ownership of the invited mailbox with the emailed one-time code.
    const { assertEmailVerified } = await import("@/lib/require-verified.server");
    try {
      await assertEmailVerified(context.userId);
    } catch {
      throw new Error("EMAIL_CODE_REQUIRED: Verify your email with the code we send, then accept again.");
    }
    const { data: owner } = await sb.from("stores").select("owner_user_id").eq("id", inv.store_id).maybeSingle();
    if (owner?.owner_user_id === context.userId) throw new Error("You already own this store");

    const name = inv.display_name || displayName(context.claims);
    const { data: existing } = await sb
      .from("store_staff")
      .select("id,access_type,status")
      .eq("store_id", inv.store_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing && existing.status === "active" && existing.access_type !== "delegated") {
      throw new Error("You are already a team member of this store");
    }
    const row = {
      store_id: inv.store_id,
      user_id: context.userId,
      name,
      email: inv.email,
      role: inv.role,
      status: "active",
      permissions: inv.permissions ?? {},
      access_type: "delegated",
      expires_at: inv.access_expires_at,
      invited_by: inv.invited_by,
      joined_at: now,
      created_by: inv.invited_by,
    };
    const { error } = existing
      ? await sb.from("store_staff").update(row).eq("id", existing.id)
      : await sb.from("store_staff").insert(row);
    if (error) throw new Error(error.message);

    await sb
      .from("store_access_invitations")
      .update({ status: "accepted", responded_at: now, accepted_user_id: context.userId })
      .eq("id", inv.id);
    await log(sb, {
      store_id: inv.store_id,
      actor_user_id: context.userId,
      actor_name: name,
      actor_kind: "employee",
      action: "access.accept",
      summary: `Access granted to ${inv.email} (${ROLE_LABEL[inv.role] ?? inv.role})`,
    });
    return { ok: true, storeId: inv.store_id as string };
  });
