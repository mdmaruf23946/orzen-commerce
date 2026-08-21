// Server-only calling provider adapters for the Manual Call Center.
// Credentials are stored AES-256-GCM encrypted; never returned to the browser.
import { createHmac, timingSafeEqual } from "node:crypto";
import { encryptJSON, decryptJSON, credentialsPreview } from "@/lib/crypto/credentials.server";
import { toE164, type CallStatus } from "@/lib/call-center";

export type TwilioCreds = {
  account_sid: string;
  auth_token: string;
};

export function encryptCreds(creds: Record<string, string>): { enc: string; preview: string } {
  return { enc: encryptJSON(creds), preview: credentialsPreview(creds) };
}

export function readCreds<T = Record<string, string>>(stored?: string | null): T | null {
  if (!stored) return null;
  try {
    return decryptJSON<T>(stored);
  } catch {
    return null;
  }
}

const TWILIO_BASE = "https://api.twilio.com/2010-04-01/Accounts";

function basic(creds: TwilioCreds) {
  return "Basic " + Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString("base64");
}

/** Cheap credential check — fetches the account resource. */
export async function twilioVerify(creds: TwilioCreds): Promise<void> {
  const res = await fetch(`${TWILIO_BASE}/${encodeURIComponent(creds.account_sid)}.json`, {
    headers: { Authorization: basic(creds) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(twilioMessage(res.status, body));
  }
}

/**
 * Click-to-call: ring the agent's phone first, then bridge to the customer.
 * Returns the provider call SID used to track status updates.
 */
export async function twilioStartCall(opts: {
  creds: TwilioCreds;
  callerId: string;
  agentPhone: string;
  customerPhone: string;
  statusCallbackUrl: string;
}): Promise<string> {
  const customer = toE164(opts.customerPhone);
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${escapeXml(opts.callerId)}" answerOnBridge="true">` +
    `<Number>${escapeXml(customer)}</Number></Dial></Response>`;

  const body = new URLSearchParams({
    To: toE164(opts.agentPhone),
    From: opts.callerId,
    Twiml: twiml,
    StatusCallback: opts.statusCallbackUrl,
    StatusCallbackMethod: "POST",
  });
  for (const ev of ["initiated", "ringing", "answered", "completed"]) {
    body.append("StatusCallbackEvent", ev);
  }

  const res = await fetch(`${TWILIO_BASE}/${encodeURIComponent(opts.creds.account_sid)}/Calls.json`, {
    method: "POST",
    headers: { Authorization: basic(opts.creds), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(twilioMessage(res.status, text));
  const json = JSON.parse(text) as { sid?: string };
  if (!json.sid) throw new Error("The calling provider did not return a call reference.");
  return json.sid;
}

/** Map Twilio call status onto our internal status. */
export function mapTwilioStatus(status: string): CallStatus {
  switch (status) {
    case "queued":
    case "initiated":
      return "calling";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "answered";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "canceled":
      return "missed";
    default:
      return "failed";
  }
}

/** Validate Twilio's X-Twilio-Signature over the full URL + sorted POST params. */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Human-readable message; never leaks raw provider payloads to the admin UI. */
function twilioMessage(status: number, body: string): string {
  let code: number | undefined;
  try {
    code = (JSON.parse(body) as any)?.code;
  } catch {
    /* ignore */
  }
  if (status === 401) return "The calling provider rejected these credentials.";
  if (code === 21212 || code === 21210) return "The caller ID / business number is not valid for this account.";
  if (code === 21211) return "The customer's phone number is not valid.";
  if (code === 21606) return "This caller ID is not verified with the calling provider.";
  if (status === 429) return "The calling provider is rate limiting requests. Please try again shortly.";
  return "The calling provider could not start this call. Please try again.";
}

function escapeXml(v: string) {
  return v.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}
