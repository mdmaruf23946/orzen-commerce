import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveStoreAccess } from "@/lib/store-access";

type AccountMetadata = {
  owner_name?: string;
  full_name?: string;
  name?: string;
  avatar_url?: string;
  cover_url?: string;
};

function resolveName(metadata: AccountMetadata, staffName: string | null, email: string) {
  return metadata.owner_name?.trim()
    || metadata.full_name?.trim()
    || metadata.name?.trim()
    || staffName?.trim()
    || email.split("@")[0]
    || "Account";
}

export const getAccountProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !data.user) throw new Error("Account details could not be loaded");

    const access = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    const metadata = (data.user.user_metadata ?? {}) as AccountMetadata;
    const email = data.user.email ?? "";

    return {
      id: data.user.id,
      name: resolveName(metadata, access.staff?.name ?? null, email),
      email,
      avatarUrl: metadata.avatar_url?.trim() || null,
      coverUrl: metadata.cover_url?.trim() || null,
      accountType: access.isOwner ? "Store owner" : access.staff ? "Team member" : "Merchant",
      role: access.staff?.role ?? (access.isOwner ? "Owner" : null),
      storeId: access.storeId,
      emailVerified: Boolean(data.user.email_confirmed_at),
      createdAt: data.user.created_at,
      lastSignInAt: data.user.last_sign_in_at ?? null,
    };
  });

// Server client has no stored session (bearer only), so updateUser() fails with
// "Auth session missing". Update the verified caller's own metadata via admin API.
async function patchOwnMetadata(
  supabase: { auth: { getUser: () => Promise<{ data: { user: { id: string; user_metadata: unknown } | null }; error: unknown }> } },
  patch: Partial<AccountMetadata>,
) {
  const { data: current, error: readError } = await supabase.auth.getUser();
  if (readError || !current.user) throw new Error("Account could not be verified");
  const metadata = (current.user.user_metadata ?? {}) as AccountMetadata;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(current.user.id, {
    user_metadata: { ...metadata, ...patch },
  });
  if (error) throw new Error(error.message);
}

const mediaValue = z.string().trim().max(500).nullable()
  .refine((v) => v === null || !v.startsWith("data:"), "Invalid image");

export const updateAccountProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await patchOwnMetadata(context.supabase as never, { owner_name: data.name, full_name: data.name });
    return { ok: true };
  });

export const updateAccountMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    kind: z.enum(["avatar", "cover"]),
    value: mediaValue,
  }).parse(input))
  .handler(async ({ data, context }) => {
    await patchOwnMetadata(context.supabase as never,
      data.kind === "avatar" ? { avatar_url: data.value || undefined } : { cover_url: data.value || undefined });
    return { ok: true };
  });