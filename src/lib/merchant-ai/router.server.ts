// Channel router: decides whether an incoming message is a merchant command
// (verified identity → Master Agent) or a normal customer message (handled by
// the existing customer flow). Returns null when it is NOT a merchant command,
// so existing behaviour continues untouched.
import { ensureThread, logActivity, withinRateLimit, type Db } from "./core.server";
import { resolveMerchantIdentity, tryVerifyWithCode, type Channel } from "./identity.server";
import { runMasterAgent } from "./master.server";

export type ChannelResult = { handled: true; reply: string } | null;

export async function handleMerchantChannelMessage(
  db: Db,
  storeId: string,
  channel: Channel,
  senderId: string,
  text: string,
): Promise<ChannelResult> {
  const body = (text ?? "").trim();
  if (!body) return null;

  // A sender can only become a merchant identity by sending the code that the
  // merchant generated inside their own panel for that exact identifier.
  const verified = await resolveMerchantIdentity(db, storeId, channel, senderId);
  if (!verified) {
    const justVerified = await tryVerifyWithCode(db, storeId, channel, senderId, body);
    if (!justVerified) return null;
    await logActivity(db, storeId, {
      agent: "master",
      actionKey: "identity_verified",
      message: `Merchant identity verified on ${channel}`,
    });
    return {
      handled: true,
      reply:
        "Verified. You can now control your store from here — try \"today's orders\" or \"find order 01700000000\".",
    };
  }

  if (!(await withinRateLimit(db, storeId, senderId))) {
    return { handled: true, reply: "Too many commands right now. Please wait a minute and try again." };
  }

  const threadId = await ensureThread(db, storeId, channel, senderId, `${channel} commands`);
  try {
    const { reply } = await runMasterAgent({
      db,
      storeId,
      text: body,
      via: channel,
      threadId,
      identityLabel: verified.label ?? null,
    });
    return { handled: true, reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    await logActivity(db, storeId, {
      agent: "master",
      actionKey: "command_failed",
      level: "error",
      message: msg,
    });
    return { handled: true, reply: `Sorry, I could not complete that: ${msg}` };
  }
}
