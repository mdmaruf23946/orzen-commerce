import { decryptJSON, encryptJSON } from "@/lib/crypto/credentials.server";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type MessengerBuyPayload = {
  storeId: string;
  psid: string;
  productId: string;
  expiresAt: number;
};

export function createMessengerBuyLink(input: Omit<MessengerBuyPayload, "expiresAt">) {
  const token = encryptJSON({ ...input, expiresAt: Date.now() + MAX_AGE_MS });
  const origin = (process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "");
  return `${origin}/api/public/messenger/buy?token=${encodeURIComponent(token)}`;
}

export function readMessengerBuyLink(token: string): MessengerBuyPayload | null {
  try {
    const payload = decryptJSON<MessengerBuyPayload>(token);
    if (
      !payload ||
      !/^[0-9a-f-]{36}$/i.test(payload.storeId) ||
      !/^[0-9a-f-]{36}$/i.test(payload.productId) ||
      !/^\d+$/.test(payload.psid) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}