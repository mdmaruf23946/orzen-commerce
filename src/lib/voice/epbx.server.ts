// ePBX adapter. The real endpoints/auth/IVR/webhook format must come from the
// ePBX API documentation; until then every call fails honestly so nothing is
// ever marked connected or shows fake data.
import { VoiceProviderError, type VoiceProvider } from "./types";

const PENDING = "ePBX connection is not available yet. We are finishing the ePBX setup — please try again later.";

function pending(): never {
  throw new VoiceProviderError("not_supported", PENDING);
}

export const epbxProvider: VoiceProvider = {
  id: "epbx",
  label: "ePBX",
  ready: false,
  async testConnection() { return pending(); },
  async getBalance() { return pending(); },
  async getNumbers() { return pending(); },
  async makeCall() { return pending(); },
  async makeOrderVerificationCall() { return pending(); },
  parseWebhook() { return null; },
};
