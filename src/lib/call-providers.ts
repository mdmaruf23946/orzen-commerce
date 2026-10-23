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
  prefix?: string;
  extraNumbers?: string[];
  connectedAt: string;
};
export type CallLog = { id: string; at: string; number: string; providerId: string; durationSec: number; status: "completed" | "missed" | "failed" | "busy"; recordingUrl?: string };
export type CallSettings = { record: boolean; hoursOn: boolean; start: string; end: string; days: number[] };

export const PROVIDERS = [
  { id: "brilliant", name: "Brilliant Connect", host: "sip.brilliant.com.bd" },
  { id: "amberit", name: "Amber IT", host: "sip.amberit.com.bd" },
  { id: "link3", name: "Link3", host: "sip.link3.net" },
  { id: "bdcom", name: "BDCOM Online", host: "sip.bdcom.com" },
  { id: "btcl", name: "BTCL Alaap", host: "alaap.btcl.com.bd" },
  { id: "ummah", name: "Ummah Host", host: "sip.ummahhost.com" },
  { id: "mytel", name: "MyTel", host: "sip.mytel.com.bd" },
  { id: "custom", name: "Custom SIP", host: "sip.example.com" },
] as const;

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
export const DEFAULT_SETTINGS: CallSettings = { record: true, hoursOn: false, start: "10:00", end: "20:00", days: [0, 1, 2, 3, 4, 6] };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read<Partial<CallSettings>>(K.set, {}) });
export const saveSettings = (s: CallSettings) => write(K.set, s);
export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export function validateConfig(c: Partial<ProviderConfig>): string | null {
  if (!c.host?.trim()) return "SIP Domain / Host is required";
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(c.host.trim())) return "SIP host looks invalid";
  if (!c.username?.trim()) return "SIP Username / DID is required";
  if (!c.password?.trim()) return "SIP Password is required";
  if (!c.callerId?.trim()) return "Caller ID is required";
  if (c.wsUrl && !/^wss:\/\//.test(c.wsUrl)) return "WebSocket URL must start with wss://";
  return null;
}
