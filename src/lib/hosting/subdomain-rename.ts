// Shared rename guard: the new <slug>.<root> must be live on the Worker
// BEFORE the store's slug changes, otherwise the rename is refused with a
// clear error (no silent failures).
export type AttachResult = { ok: boolean; reason?: string; error?: string };

export function renameAttachError(host: string, res: AttachResult): string | null {
  if (res.ok) return null;
  if (res.reason === "not_configured") {
    return `নতুন ঠিকানা ${host} লাইভ সার্ভারে যুক্ত করা যায়নি (automatic connection চালু নেই)। ঠিকানা বদলানো হয়নি। / Could not connect ${host} to the live site — address not changed.`;
  }
  return `নতুন ঠিকানা ${host} লাইভ সার্ভারে যুক্ত করা যায়নি, তাই ঠিকানা বদলানো হয়নি। একটু পরে আবার চেষ্টা করুন। / Could not connect ${host} to the live site, so the address was not changed.${res.error ? ` (${res.error})` : ""}`;
}

export async function attachNewSubdomainOrThrow(
  host: string,
  attach: (h: string) => Promise<AttachResult>,
): Promise<void> {
  let res: AttachResult;
  try {
    res = await attach(host);
  } catch (e) {
    res = { ok: false, reason: "error", error: (e as Error).message };
  }
  const msg = renameAttachError(host, res);
  if (msg) {
    console.error(`[subdomain] attach failed for ${host}: ${res.reason ?? ""} ${res.error ?? ""}`);
    throw new Error(msg);
  }
}
