// Registry of Call & SMS providers. A provider gets its own sidebar menu ONLY
// while it is connected for the store; otherwise it shows only on the
// "AI & SMS Apps" hub with a Connect button. Provider features never mix.
// SMS = standard mobile-number SMS only (not Messenger/WhatsApp/chat).
export type CallSmsProviderSection = { key: string; label: string };

export type CallSmsProvider = {
  id: string;
  name: string;
  kind: "call" | "sms" | "call_sms";
  path: string;
  description: string;
  /** Provider-specific workspace sections, from its capabilities. */
  sections: CallSmsProviderSection[];
  /** Section that holds the connect/setup form. */
  setupSection: string;
};

export const CALL_SMS_HUB_PATH = "/admin/call-sms/apps";

export const CALL_SMS_PROVIDERS: CallSmsProvider[] = [
  {
    id: "epbx",
    name: "ePBX",
    kind: "call",
    path: "/admin/call-sms/epbx",
    description: "Voice calling: automatic order confirmation calls, customer calls, history & recordings.",
    setupSection: "integration",
    sections: [
      { key: "overview", label: "Overview" },
      { key: "integration", label: "Integration" },
      { key: "numbers", label: "Phone Numbers" },
      { key: "extensions", label: "Extensions" },
      { key: "settings", label: "Call Settings" },
      { key: "automation", label: "AI Call Automation" },
      { key: "ivr", label: "IVR" },
      { key: "calls", label: "Call History" },
      { key: "recordings", label: "Recordings" },
    ],
  },
];

/** Connection status per provider id, from the store's own connection rows. */
export type ProviderConnectionMap = Record<string, boolean>;
