// Merchant identity verification for channel commands.
// Only a row that is BOTH stored for this store AND verified may drive the
// Master Agent. Nothing a sender writes ("I am the owner") can change this.
import type { Db } from "./core.server";

export type Channel = "messenger" | "whatsapp";

export function normalizeIdentifier(channel: Channel, raw: string) {
  const value = (raw ?? "").trim();
  if (channel === "whatsapp") return value.replace(/[^\d]/g, "");
  return value;
}

/** Returns the verified merchant identity row for this sender, or null. */
export async function resolveMerchantIdentity(
  db: Db,
  storeId: string,
  channel: Channel,
  rawIdentifier: string,
) {
  const identifier = normalizeIdentifier(channel, rawIdentifier);
  if (!identifier) return null;
  const { data } = await db
    .from("store_ai_identities")
    .select("id, label, identifier, channel, verified")
    .eq("store_id", storeId)
    .eq("channel", channel)
    .eq("identifier", identifier)
    .eq("verified", true)
    .maybeSingle();
  if (!data) return null;
  await db
    .from("store_ai_identities")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return data as { id: string; label: string | null; identifier: string; channel: Channel };
}

/** All verified identities of a store — used to fan out notifications. */
export async function verifiedIdentities(db: Db, storeId: string, channel?: Channel) {
  let q = db
    .from("store_ai_identities")
    .select("channel, identifier, label")
    .eq("store_id", storeId)
    .eq("verified", true);
  if (channel) q = q.eq("channel", channel);
  const { data } = await q;
  return (data ?? []) as { channel: Channel; identifier: string; label: string | null }[];
}

export function makeVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Confirms an identity when the pending code arrives from that exact sender
 * on that exact channel. Returns the label when it matched.
 */
export async function tryVerifyWithCode(
  db: Db,
  storeId: string,
  channel: Channel,
  rawIdentifier: string,
  text: string,
) {
  const code = (text.match(/\b(\d{6})\b/) ?? [])[1];
  if (!code) return null;
  const identifier = normalizeIdentifier(channel, rawIdentifier);
  const { data } = await db
    .from("store_ai_identities")
    .select("id, label")
    .eq("store_id", storeId)
    .eq("channel", channel)
    .eq("identifier", identifier)
    .eq("verify_code", code)
    .gt("verify_expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await db
    .from("store_ai_identities")
    .update({ verified: true, verify_code: null, verify_expires_at: null })
    .eq("id", data.id);
  return data as { id: string; label: string | null };
}

/**
 * An unverified identity waiting for its code on this channel — used so the
 * webhook knows a code reply may be coming from this sender.
 */
export async function hasPendingVerification(db: Db, storeId: string, channel: Channel) {
  const { count } = await db
    .from("store_ai_identities")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("channel", channel)
    .eq("verified", false)
    .gt("verify_expires_at", new Date().toISOString());
  return (count ?? 0) > 0;
}

/** Whether this exact sender has a pending identity. Never matches by message claims. */
export async function pendingIdentityForSender(
  db: Db,
  storeId: string,
  channel: Channel,
  rawIdentifier: string,
) {
  const identifier = normalizeIdentifier(channel, rawIdentifier);
  const { data } = await db
    .from("store_ai_identities")
    .select("id")
    .eq("store_id", storeId)
    .eq("channel", channel)
    .eq("identifier", identifier)
    .eq("verified", false)
    .gt("verify_expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}
