// Manual Call (beta) provider configs, history and settings — stored in the
// browser for now (UI ready for SIP integration; no backend yet).
export type Transport = "WSS" | "UDP" | "TCP" | "TLS";
export type ProviderConfig = {
  providerId: string;
  mode: "byoc" | "rented";
  host: string;
  username: string;
  password: string;
  callerId: string;
  extension?: string;
  transport: Transport;
  stun?: string;
  wsUrl?: string;
  outboundProxy?: string;
  prefix?: string;
  extraNumbers?: string[];
  connectedAt: string;
};
export type CallLog = { id: string; at: string; number: string; providerId: string; durationSec: number; status: "completed" | "missed" | "failed" | "busy"; recordingUrl?: string; recordingPath?: string };
export type CallSettings = { record: boolean; hoursOn: boolean; start: string; end: string; days: number[] };

/** How a provider hands out credentials — decides which form the merchant sees. */
export type ConnectKind = "ip_trunk" | "cloud_pbx" | "webrtc";
export type FieldKey = "host" | "username" | "password" | "callerId" | "extension" | "wsUrl" | "outboundProxy" | "stun" | "prefix";
export type ProviderProfile = {
  id: string; name: string; host: string; kind: ConnectKind; numberPrefix?: string;
  tagline: string; guide: string[]; fields: FieldKey[]; required: FieldKey[];
  labels?: Partial<Record<FieldKey, string>>; placeholders?: Partial<Record<FieldKey, string>>;
};

const TRUNK: FieldKey[] = ["host", "outboundProxy", "username", "password", "callerId", "wsUrl", "prefix"];
const PBX: FieldKey[] = ["host", "extension", "username", "password", "callerId", "wsUrl", "stun"];
const WEB: FieldKey[] = ["wsUrl", "host", "extension", "username", "password", "callerId", "stun"];

export const PROVIDERS: ProviderProfile[] = [
  { id: "brilliant", name: "Brilliant Connect", host: "sip.brilliant.com.bd", kind: "ip_trunk", numberPrefix: "09638",
    tagline: "09638 IP Telephony · Business SIP Trunk",
    guide: ["মোবাইল অ্যাপের OTP login দিয়ে হবে না — Brilliant থেকে Business/Corporate SIP account নিন।", "তারা 09638 pilot number, SIP user ও password দেবে।", "ওয়েবসাইট থেকে কল করতে তাদের কাছে WebRTC (WSS) access চাইতে হবে।"],
    fields: TRUNK, required: ["host", "username", "password", "callerId"],
    labels: { username: "SIP Auth User / Pilot Number", callerId: "09638 Pilot Number" }, placeholders: { username: "09638XXXXXX", callerId: "09638XXXXXX" } },
  { id: "btcl", name: "BTCL Alaap", host: "alaap.btcl.com.bd", kind: "ip_trunk", numberPrefix: "09666",
    tagline: "09666 · Corporate IP PABX",
    guide: ["Alaap অ্যাপের ব্যক্তিগত account এখানে চলবে না।", "BTCL অফিস থেকে Corporate IP Telephony/PABX চালু করুন — 09666 number ও SIP password দেবে।", "WebRTC (WSS) সুবিধা আছে কিনা BTCL-কে জিজ্ঞেস করুন।"],
    fields: TRUNK, required: ["host", "username", "password", "callerId"],
    labels: { host: "PABX Server IP / Domain", username: "Pilot Number", callerId: "09666 Display Number" }, placeholders: { username: "09666XXXXXX", callerId: "09666XXXXXX" } },
  { id: "amberit", name: "Amber IT", host: "sip.amberit.com.bd", kind: "cloud_pbx", numberPrefix: "09611",
    tagline: "09611 · Cloud PBX extension",
    guide: ["Amber IT Cloud PBX panel থেকে একটি extension (যেমন 101) তৈরি করুন।", "Extension number, password ও PBX domain কপি করুন।", "ব্রাউজার কলের জন্য WebRTC/WSS চালু রাখতে বলুন।"],
    fields: PBX, required: ["host", "extension", "password", "callerId"],
    labels: { host: "PBX Domain / Realm", username: "Auth ID (না থাকলে খালি রাখুন)", callerId: "09611 Caller ID" }, placeholders: { callerId: "09611XXXXXX" } },
  { id: "link3", name: "Link3", host: "sip.link3.net", kind: "ip_trunk", numberPrefix: "09678",
    tagline: "09678 · SIP Trunk with Registrar/Proxy",
    guide: ["Link3 IP Telephony service থেকে SIP Trunk নিন।", "Registrar host, Outbound proxy (যদি দেয়), auth user ও secret লিখুন।", "ব্রাউজার কলের জন্য WSS URL লাগবে।"],
    fields: TRUNK, required: ["host", "username", "password", "callerId"],
    labels: { host: "Registrar Host", password: "Auth Secret", callerId: "09678 Caller ID" }, placeholders: { callerId: "09678XXXXXX" } },
  { id: "bdcom", name: "BDCOM Online", host: "sip.bdcom.com", kind: "ip_trunk", numberPrefix: "09669",
    tagline: "09669 · IP Telephony gateway",
    guide: ["BDCOM থেকে Business IP Telephony account নিন।", "Gateway domain, account ID ও password লিখুন।", "WSS সুবিধা নিশ্চিত করুন।"],
    fields: TRUNK, required: ["host", "username", "password", "callerId"],
    labels: { host: "Gateway Domain", username: "Account ID", callerId: "09669 Caller ID" }, placeholders: { callerId: "09669XXXXXX" } },
  { id: "ummah", name: "Ummah Host", host: "sip.ummahhost.com", kind: "cloud_pbx",
    tagline: "Hosted Cloud PBX",
    guide: ["Ummah Host PBX panel থেকে extension তৈরি করুন।", "Extension, secret, domain ও WSS URL কপি করুন।"],
    fields: PBX, required: ["host", "extension", "password", "callerId"] },
  { id: "mytel", name: "MyTel", host: "sip.mytel.com.bd", kind: "cloud_pbx",
    tagline: "Business PBX extension",
    guide: ["MyTel business PBX/SIP account থেকে extension ও password নিন।", "Domain ও WSS URL provider থেকে নিশ্চিত করুন।"],
    fields: PBX, required: ["host", "extension", "password", "callerId"] },
  { id: "custom", name: "Custom WebRTC / PBX", host: "pbx.example.com", kind: "webrtc",
    tagline: "Asterisk, FreePBX, FusionPBX ইত্যাদি",
    guide: ["নিজের PBX-এ WebRTC চালু করা extension দরকার।", "WSS URL (wss://...:8089/ws), domain, extension ও secret লিখুন।"],
    fields: WEB, required: ["wsUrl", "host", "extension", "password"] },
];

export const KIND_LABEL: Record<ConnectKind, string> = { ip_trunk: "SIP Trunk", cloud_pbx: "Cloud PBX", webrtc: "WebRTC" };

const K = { cfg: "orzen.call.providers", log: "orzen.call.history", set: "orzen.call.settings" };
const read = <T,>(k: string, d: T): T => {
  if (typeof window === "undefined") return d;
  try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; }
};
const write = (k: string, v: unknown) => { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event("orzen-call-store")); };

export const getConfigs = () => read<Record<string, ProviderConfig>>(K.cfg, {});
export const saveConfig = (c: ProviderConfig) => write(K.cfg, { ...getConfigs(), [c.providerId]: c });
export const removeConfig = (id: string) => { const all = getConfigs(); delete all[id]; write(K.cfg, all); };
export const getHistory = () => read<CallLog[]>(K.log, []);
export const addHistory = (l: CallLog) => write(K.log, [l, ...getHistory()].slice(0, 500));
export const patchHistory = (id: string, p: Partial<CallLog>) => write(K.log, getHistory().map((h) => (h.id === id ? { ...h, ...p } : h)));
/** True when calls are allowed now under the business-hours setting. */
export function withinHours(s: CallSettings, d = new Date()) {
  if (!s.hoursOn) return true;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return s.days.includes(d.getDay()) && hm >= s.start && hm <= s.end;
}
export const DEFAULT_SETTINGS: CallSettings = { record: true, hoursOn: false, start: "10:00", end: "20:00", days: [0, 1, 2, 3, 4, 6] };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read<Partial<CallSettings>>(K.set, {}) });
export const saveSettings = (s: CallSettings) => write(K.set, s);
export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

const FIELD_NAME: Record<FieldKey, string> = { host: "Server / Domain", username: "Username", password: "Password", callerId: "Caller ID", extension: "Extension", wsUrl: "WebSocket (WSS) URL", outboundProxy: "Outbound Proxy", stun: "STUN", prefix: "Prefix" };
export const getProfile = (id?: string) => PROVIDERS.find((p) => p.id === id);
/** SIP login user: explicit username, else the PBX extension. */
export const sipUser = (c: Pick<ProviderConfig, "username" | "extension">) => c.username?.trim() || c.extension?.trim() || "";

export function validateConfig(c: Partial<ProviderConfig>): string | null {
  const prof = getProfile(c.providerId);
  const req: FieldKey[] = prof?.required ?? ["host", "username", "password", "callerId"];
  for (const k of req) if (!String((c as any)[k] ?? "").trim()) return `${prof?.labels?.[k] ?? FIELD_NAME[k]} is required`;
  if (c.host && !/^[a-z0-9.-]+(:\d+)?$/i.test(c.host.trim())) return "Server / Domain looks invalid";
  if (c.wsUrl && !/^wss:\/\//.test(c.wsUrl)) return "WebSocket URL must start with wss://";
  const digits = (c.callerId ?? "").replace(/\D/g, "").replace(/^880/, "0");
  if (prof?.numberPrefix && digits && !digits.startsWith(prof.numberPrefix)) return `${prof.name} caller ID should start with ${prof.numberPrefix}`;
  return null;
}
