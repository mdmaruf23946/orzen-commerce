// Channel router: decides whether an incoming message is a merchant command
// (verified identity → Master Agent) or a normal customer message (handled by
// the existing customer flow). Returns null when it is NOT a merchant command,
// so existing behaviour continues untouched.
import { ensureThread, loadAgentState, logActivity, withinRateLimit, type Db } from "./core.server";
import {
  pendingIdentityForSender,
  resolveMerchantIdentity,
  tryVerifyWithCode,
  type Channel,
} from "./identity.server";
import { runMasterAgent } from "./master.server";
import { storeHasAiAgent } from "./plan.server";

const BENGALI = /[\u0980-\u09FF]/;


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
    if (!justVerified) {
      if (await pendingIdentityForSender(db, storeId, channel, senderId)) {
        return {
          handled: true,
          reply: "Your Merchant identity is still pending. Open Merchant Panel → AI Command Center → Merchant Identity, generate a new code, then send that 6-digit code here.",
        };
      }
      return null;
    }
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

  const bn = BENGALI.test(body);

  // Plan gate — the panel checks this too, so channels must not be a bypass.
  if (!(await storeHasAiAgent(db, storeId))) {
    await logActivity(db, storeId, {
      agent: "master",
      actionKey: "plan_blocked",
      level: "warn",
      message: `Merchant command blocked on ${channel}: plan has no AI agent`,
    });
    return {
      handled: true,
      reply: bn
        ? "আপনার বর্তমান প্ল্যানে AI Command Center নেই। Merchant Panel → Billing থেকে প্ল্যান আপডেট করলে আবার ব্যবহার করতে পারবেন।"
        : "Your current plan does not include the AI Command Center. Update your plan from Merchant Panel → Billing to use it again.",
    };
  }

  // Master Agent switched off in the panel means off on every channel.
  const state = await loadAgentState(db, storeId);
  if (state["master"] && state["master"].enabled === false) {
    return {
      handled: true,
      reply: bn
        ? "Master AI Agent এখন বন্ধ আছে। Merchant Panel → AI Command Center → Agents থেকে চালু করুন।"
        : "The Master AI Agent is currently switched off. Turn it on in Merchant Panel → AI Command Center → Agents.",
    };
  }

  if (!(await withinRateLimit(db, storeId, senderId))) {
    return {
      handled: true,
      reply: bn
        ? "একসাথে অনেক কমান্ড এসেছে। এক মিনিট পরে আবার চেষ্টা করুন।"
        : "Too many commands right now. Please wait a minute and try again.",
    };
  }

  const threadId = await ensureThread(db, storeId, channel, senderId, `${channel} commands`);
  try {
    const { reply } = await runMasterAgent({
      db,
      storeId,
      text: body,
      via: channel,
      threadId,
      identityRef: senderId,
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
